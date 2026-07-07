import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function getAuthUser(request) {
  const authCookie = request.cookies.get('nexus_user');
  if (!authCookie) return null;
  try {
    return JSON.parse(authCookie.value);
  } catch {
    return null;
  }
}

export async function POST(request) {
  const user = getAuthUser(request);
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const allTickets = await prisma.ticket.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, subject: true, sender: true, serialNo: true, createdAt: true },
    });

    // Find duplicates by subject only
    const seen = new Map();
    const toDelete = [];

    for (const ticket of allTickets) {
      const key = ticket.subject.trim().toLowerCase();
      if (seen.has(key)) {
        toDelete.push(ticket.id);
      } else {
        seen.set(key, ticket.id);
      }
    }

    if (toDelete.length > 0) {
      await prisma.ticket.deleteMany({
        where: { id: { in: toDelete } },
      });
    }

    // Renumber serials sequentially
    const remainingTickets = await prisma.ticket.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, serialNo: true },
    });

    for (let i = 0; i < remainingTickets.length; i++) {
      const newSerial = String(i + 1);
      if (remainingTickets[i].serialNo !== newSerial) {
        await prisma.ticket.update({
          where: { id: remainingTickets[i].id },
          data: { serialNo: newSerial },
        });
      }
    }

    return NextResponse.json({ success: true, deleted: toDelete.length });
  } catch (error) {
    console.error('Fix duplicates error:', error);
    return NextResponse.json({ error: 'Failed to fix duplicates' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const user = getAuthUser(request);
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Safely renumber ALL tickets sequentially as plain numbers (1, 2, 3...)
    // without deleting any data.
    const allTickets = await prisma.ticket.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, serialNo: true },
    });

    for (let i = 0; i < allTickets.length; i++) {
      const newSerial = String(i + 1);
      if (allTickets[i].serialNo !== newSerial) {
        await prisma.ticket.update({
          where: { id: allTickets[i].id },
          data: { serialNo: newSerial },
        });
      }
    }

    return NextResponse.json({ success: true, renumbered: allTickets.length });
  } catch (error) {
    console.error('Clean invalid tickets error:', error);
    return NextResponse.json({ error: 'Failed to clean invalid tickets' }, { status: 500 });
  }
}
