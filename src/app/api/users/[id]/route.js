import { NextResponse } from 'next/server';
import { prisma, withDbRetry } from '@/lib/prisma';
import { sanitizeUser } from '@/lib/api';

function getSessionUser(request) {
  const authCookie = request.headers.get('x-user-id') || request.cookies.get('nexus_user')?.value;
  if (!authCookie) return null;
  try {
    const decoded = typeof authCookie === 'string' ? decodeURIComponent(authCookie) : authCookie;
    return decoded.startsWith('{') ? JSON.parse(decoded) : null;
  } catch {
    return null;
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: 'Valid user ID is required' }, { status: 400 });
    }

    const sessionUser = getSessionUser(request);
    const isAdmin = sessionUser?.role === 'ADMIN';

    const body = await request.json();
    const { activeStatus, employeeName, pin } = body;

    const user = await withDbRetry(() => prisma.user.findUnique({ where: { id } }));
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updateData = {};

    // 1. Optional Active Status update
    if (typeof activeStatus === 'boolean') {
      if (user.role === 'ADMIN') {
        return NextResponse.json({ error: 'Cannot disable admin account' }, { status: 403 });
      }
      if (!isAdmin && Number(sessionUser?.id) !== id) {
        return NextResponse.json({ error: 'Not authorized to change this user status' }, { status: 403 });
      }
      updateData.activeStatus = activeStatus;
    }

    // 2. Employee Name edit (Admin feature)
    const oldName = (user.employeeName || '').trim();
    let newName = null;

    if (typeof employeeName === 'string') {
      if (!isAdmin) {
        return NextResponse.json({ error: 'Admin authorization required to edit employee names' }, { status: 403 });
      }
      newName = employeeName.trim();
      if (!newName) {
        return NextResponse.json({ error: 'Employee name cannot be empty' }, { status: 400 });
      }

      if (newName.toLowerCase() !== oldName.toLowerCase()) {
        const duplicate = await withDbRetry(() =>
          prisma.user.findFirst({
            where: {
              id: { not: id },
              employeeName: { equals: newName, mode: 'insensitive' },
            },
            select: { id: true, employeeName: true },
          })
        );
        if (duplicate) {
          return NextResponse.json(
            { error: `Another account already uses the name "${duplicate.employeeName}". Please choose a unique name.` },
            { status: 409 }
          );
        }
      }

      updateData.employeeName = newName;
    }

    // 3. Optional PIN update (Admin feature)
    if (typeof pin === 'string' && pin.trim().length > 0) {
      if (!isAdmin) {
        return NextResponse.json({ error: 'Admin authorization required to update PIN' }, { status: 403 });
      }
      if (user.role === 'ADMIN') {
        return NextResponse.json({ error: 'Use admin password settings to change admin credentials' }, { status: 400 });
      }
      const pinStr = pin.trim();
      if (!/^\d{4,6}$/.test(pinStr)) {
        return NextResponse.json({ error: 'PIN must be 4 to 6 numeric digits' }, { status: 400 });
      }
      updateData.password = pinStr;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided to update' }, { status: 400 });
    }

    const updated = await withDbRetry(() =>
      prisma.user.update({
        where: { id },
        data: updateData,
      })
    );

    // Safely propagate renamed employeeName across string-tracked audit fields so no history detaches
    if (
      newName &&
      oldName &&
      newName !== oldName &&
      user.role !== 'ADMIN' &&
      !['admin', 'system', 'auto-ingested', 'manual entry'].includes(oldName.toLowerCase())
    ) {
      try {
        const matchingTickets = await prisma.ticket.findMany({
          where: { statusLastChangedBy: { equals: oldName, mode: 'insensitive' } },
          select: { id: true },
        });
        if (matchingTickets.length > 0) {
          await prisma.ticket.updateMany({
            where: { id: { in: matchingTickets.map((t) => t.id) } },
            data: { statusLastChangedBy: newName },
          });
        }

        const matchingJobs = await prisma.jobMetadata.findMany({
          where: { manualEnteredBy: { equals: oldName, mode: 'insensitive' } },
          select: { id: true },
        });
        if (matchingJobs.length > 0) {
          await prisma.jobMetadata.updateMany({
            where: { id: { in: matchingJobs.map((j) => j.id) } },
            data: { manualEnteredBy: newName },
          });
        }

        await prisma.comment.updateMany({
          where: { userId: id, senderRole: 'EMPLOYEE' },
          data: { senderName: newName },
        });
      } catch (propErr) {
        console.warn('Non-fatal propagation warning on employee rename:', propErr.message);
      }
    }

    return NextResponse.json({ user: sanitizeUser(updated), oldName, newName: updated.employeeName });
  } catch (error) {
    console.error('User update error:', error);
    return NextResponse.json({ error: 'Failed to update user: ' + (error.message || '') }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);

    const user = await withDbRetry(() => prisma.user.findUnique({ where: { id } }));
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (user.role === 'ADMIN') {
      return NextResponse.json({ error: 'Cannot delete admin account' }, { status: 403 });
    }

    await withDbRetry(() => prisma.user.delete({ where: { id } }));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('User delete error:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
