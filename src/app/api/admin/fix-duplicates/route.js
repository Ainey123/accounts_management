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

/**
 * Robustly extract a deduplication key from a subject line.
 * Handles ticket numbers (including ADM/Admin patterns), strips prefixes
 * repeatedly, collapses spaces, and strips common suffixes.
 */
function getDedupKey(subject) {
  if (!subject) return '';
  let s = subject.trim();

  // Remove surrounding quotes
  s = s.replace(/^"|"$/g, '').trim();

  let lower = s.toLowerCase();

  // 1. Check for "Ticket No ADM 1196207" or "Ticket No :ADM 1196207" patterns
  const admMatch = lower.match(/ticket\s*(?:no\.?|#)?\s*:?\s*(?:adm|admin)\s*:?\s*(\d{3,})/i);
  if (admMatch) {
    return `ticket-adm-${admMatch[1]}`;
  }

  // 2. Check for "Ticket # Admin 40280" patterns
  const adminHashMatch = lower.match(/ticket\s*#\s*admin\s*(\d{3,})/i);
  if (adminHashMatch) {
    return `ticket-admin-${adminHashMatch[1]}`;
  }

  // 3. Check for numeric ticket number (e.g., "Ticket No :154678", "Ticket#154678")
  const ticketMatch = lower.match(/ticket\s*(?:no\.?|#|:)?\s*:?\s*(\d{4,})/i) || lower.match(/#\s*(\d{4,})/);
  if (ticketMatch) {
    return `ticket-${ticketMatch[1]}`;
  }

  // 4. Normalize by stripping prefixes repeatedly
  let prev = null;
  lower = s.toLowerCase();
  while (prev !== lower) {
    prev = lower;
    lower = lower
      .replace(/^\s*re\s*:/i, '')
      .replace(/^\s*fwd?\s*:/i, '')
      .replace(/^\s*fw\s*:/i, '')
      .replace(/^\s*\[external\]\s*/i, '')
      .replace(/^\s*\[ext\]\s*/i, '')
      .replace(/^\s*\[spam\]\s*/i, '')
      .replace(/^\s*atm\s*id\s*#?\s*\d+/i, '')
      .replace(/^\s*sr#?\s*\d+/i, '')
      .trim();
  }

  // 5. Strip trailing revised sets or other common boq suffixes
  lower = lower
    .replace(/\s*-\s*working\s*set.*$/i, '')
    .replace(/\s*-\s*revised\s*working\s*set.*$/i, '')
    .replace(/\s*-\s*boq.*$/i, '')
    .trim();

  // Collapse multiple spaces
  return lower.replace(/\s+/g, ' ');
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
      include: { jobMetadata: true },
    });

    // Group tickets by getDedupKey
    const groups = new Map(); // key -> ticket[]

    for (const ticket of allTickets) {
      const key = getDedupKey(ticket.subject);
      if (!key) continue;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(ticket);
    }

    const toDelete = [];

    for (const [key, group] of groups.entries()) {
      if (group.length <= 1) continue;

      // Duplicate group found! Select ONE ticket to keep:
      // Priority 1: Keep the one with jobMetadata
      // Priority 2: Keep the one not PENDING (e.g. marked RELEVANT/IRRELEVANT/CANCELLED)
      // Priority 3: Keep the oldest ticket (first in the group array since query is ordered asc)
      let master = group[0];

      const withJob = group.find((t) => t.jobMetadata !== null);
      if (withJob) {
        master = withJob;
      } else {
        const notPending = group.find((t) => t.status !== 'PENDING');
        if (notPending) {
          master = notPending;
        }
      }

      // Add all other tickets in this group to deletion list
      for (const ticket of group) {
        if (ticket.id !== master.id) {
          toDelete.push(ticket.id);
        }
      }
    }

    // Delete duplicates that don't have jobMetadata (to avoid data loss)
    let actuallyDeleted = 0;
    if (toDelete.length > 0) {
      const safeToDelete = await prisma.ticket.findMany({
        where: { id: { in: toDelete }, jobMetadata: null },
        select: { id: true },
      });
      const safeIds = safeToDelete.map((t) => t.id);

      if (safeIds.length > 0) {
        await prisma.ticket.deleteMany({ where: { id: { in: safeIds } } });
        actuallyDeleted = safeIds.length;
      }
    }

    // Renumber all serials sequentially (1, 2, 3...)
    await renumberAllTickets();

    return NextResponse.json({
      success: true,
      deleted: actuallyDeleted,
      skippedWithJob: toDelete.length - actuallyDeleted,
    });
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
    await renumberAllTickets();
    return NextResponse.json({ success: true, renumbered: await prisma.ticket.count() });
  } catch (error) {
    console.error('Clean invalid tickets error:', error);
    return NextResponse.json({ error: 'Failed to clean invalid tickets' }, { status: 500 });
  }
}
