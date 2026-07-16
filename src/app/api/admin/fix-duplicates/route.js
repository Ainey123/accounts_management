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
 * Normalize a subject line for deduplication:
 * - Strip RE:, Fwd:, Fw:, [External], [EXT] prefixes (case-insensitive, repeated)
 * - Collapse whitespace
 */
function normalizeSubject(subject) {
  if (!subject) return '';
  let s = subject.trim();
  // Repeatedly strip known prefixes
  let prev = null;
  while (prev !== s) {
    prev = s;
    s = s
      .replace(/^\s*re\s*:/i, '')
      .replace(/^\s*fwd?\s*:/i, '')
      .replace(/^\s*\[external\]\s*/i, '')
      .replace(/^\s*\[ext\]\s*/i, '')
      .replace(/^\s*\[spam\]\s*/i, '')
      .trim();
  }
  // Also collapse extra spaces
  return s.replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Extract a ticket/job reference number from a subject.
 * Looks for patterns like "Ticket No :163755", "Ticket#163755", "Ticket No. 163755"
 */
function extractTicketRef(subject) {
  if (!subject) return null;
  const match = subject.match(/ticket\s*(?:no\.?|#|:)?\s*:?\s*(\d{4,})/i);
  return match ? match[1] : null;
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

    // Build dedup map using BOTH normalized subject AND extracted ticket ref number
    const seenNormalized = new Map(); // normalizedSubject -> id
    const seenTicketRef = new Map();  // ticketRefNumber -> id
    const toDelete = [];

    for (const ticket of allTickets) {
      const normalized = normalizeSubject(ticket.subject);
      const ticketRef = extractTicketRef(ticket.subject);

      // Check if a ticket with the same ticket reference number already exists
      if (ticketRef && seenTicketRef.has(ticketRef)) {
        toDelete.push(ticket.id);
        continue;
      }

      // Check if a ticket with the same normalized subject already exists
      if (seenNormalized.has(normalized)) {
        toDelete.push(ticket.id);
        continue;
      }

      // Mark as seen
      seenNormalized.set(normalized, ticket.id);
      if (ticketRef) seenTicketRef.set(ticketRef, ticket.id);
    }

    // Delete duplicates that don't have a jobMetadata (to avoid data loss)
    let actuallyDeleted = 0;
    if (toDelete.length > 0) {
      // Only delete tickets that have no job attached (safe to remove)
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

    // Renumber all serials sequentially (1, 2, 3...) in a single atomic statement
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
    // Safely renumber ALL tickets sequentially as plain numbers (1, 2, 3...)
    // without deleting any data.
    await renumberAllTickets();

    return NextResponse.json({ success: true, renumbered: await prisma.ticket.count() });
  } catch (error) {
    console.error('Clean invalid tickets error:', error);
    return NextResponse.json({ error: 'Failed to clean invalid tickets' }, { status: 500 });
  }
}
