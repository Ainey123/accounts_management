import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { renumberTicketsByDate } from '@/lib/serial';

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
      orderBy: { exactDate: 'asc' },
      select: { id: true, subject: true, serialNo: true, exactDate: true, jobMetadata: { select: { id: true } } },
    });

    // Group tickets by normalized subject (same subject == same ticket, regardless of date/sender)
    const groups = new Map();
    for (const ticket of allTickets) {
      const key = ticket.subject.trim().toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(ticket);
    }

    const toDelete = [];
    let skippedConflicts = 0;

    for (const group of groups.values()) {
      if (group.length <= 1) continue;

      const withMetadata = group.filter((t) => t.jobMetadata);
      if (withMetadata.length > 1) {
        // Two or more duplicates already have real job data attached — never
        // auto-delete work data. Leave this group for manual review.
        skippedConflicts += group.length;
        continue;
      }

      if (withMetadata.length === 1) {
        // Keep the ticket that already has job metadata; the rest are unactioned dupes.
        const keepId = withMetadata[0].id;
        for (const t of group) {
          if (t.id !== keepId) toDelete.push(t.id);
        }
      } else {
        // No job metadata on any of them yet — keep the earliest (oldest exactDate).
        const [, ...rest] = group; // group is already sorted by exactDate ascending
        for (const t of rest) toDelete.push(t.id);
      }
    }

    if (toDelete.length > 0) {
      await prisma.ticket.deleteMany({
        where: { id: { in: toDelete } },
      });
    }

    // Renumber all serials chronologically by exactDate in a single atomic statement
    await renumberTicketsByDate();

    return NextResponse.json({ success: true, deleted: toDelete.length, skippedConflicts });
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
    // Safely renumber ALL tickets sequentially as plain numbers (1, 2, 3...),
    // ordered chronologically by exactDate, without deleting any data.
    await renumberTicketsByDate();

    return NextResponse.json({ success: true, renumbered: await prisma.ticket.count() });
  } catch (error) {
    console.error('Clean invalid tickets error:', error);
    return NextResponse.json({ error: 'Failed to clean invalid tickets' }, { status: 500 });
  }
}
