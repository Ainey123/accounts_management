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
      select: { id: true, subject: true, createdAt: true },
    });

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

    return NextResponse.json({ success: true, deleted: toDelete.length });
  } catch (error) {
    console.error('Fix duplicates error:', error);
    return NextResponse.json({ error: 'Failed to fix duplicates' }, { status: 500 });
  }
}
