import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sanitizeUser } from '@/lib/api';

export async function PATCH(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const { activeStatus } = await request.json();

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (user.role === 'ADMIN') {
      return NextResponse.json({ error: 'Cannot modify admin account' }, { status: 403 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { activeStatus: Boolean(activeStatus) },
    });

    return NextResponse.json({ user: sanitizeUser(updated) });
  } catch (error) {
    console.error('User update error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (user.role === 'ADMIN') {
      return NextResponse.json({ error: 'Cannot delete admin account' }, { status: 403 });
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('User delete error:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
