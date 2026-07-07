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

// Single atomic renumber: assigns 1, 2, 3... to all tickets ordered by creation.
async function renumberAllTickets() {
  await prisma.$executeRawUnsafe(`
    UPDATE "Ticket" AS t
    SET "serialNo" = sub."newSerial"
    FROM (
      SELECT id, CAST(ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC) AS TEXT) AS "newSerial"
      FROM "Ticket"
    ) AS sub
    WHERE t.id = sub.id;
  `);
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

    // Renumber all serials sequentially (1, 2, 3...) in a single atomic statement
    await renumberAllTickets();

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
    await renumberAllTickets();

    return NextResponse.json({ success: true, renumbered: await prisma.ticket.count() });
  } catch (error) {
    console.error('Clean invalid tickets error:', error);
    return NextResponse.json({ error: 'Failed to clean invalid tickets' }, { status: 500 });
  }
}
