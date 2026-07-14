import { prisma } from '@/lib/prisma';

// Returns the next serial number to assign to a brand-new ticket: one more than
// the highest numeric serial currently in use. It must look at the true numeric
// maximum (not the last-inserted row) because renumberTicketsByDate() reorders
// serials by email date, so the newest row does NOT necessarily hold the highest
// serial. Picking by insertion order there would return a value that already
// exists and collide with the UNIQUE constraint. The regex filter skips any
// non-numeric/temporary serials so CAST never fails on them.
export async function nextTicketSerialNo() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COALESCE(MAX(CAST("serialNo" AS INTEGER)), 0) AS max FROM "Ticket" WHERE "serialNo" ~ '^[0-9]+$';`
  );
  const max = Number(rows?.[0]?.max ?? 0);
  return String(max + 1);
}

// Renumbers every ticket's serialNo as 1, 2, 3... ordered by the actual email/entry
// date (exactDate), oldest first — so a January email is always serial 1 and the
// most recent ticket always carries the highest serial, regardless of the order
// tickets were synced/inserted in.
//
// Done in two phases inside a transaction because serialNo has a UNIQUE
// constraint: a single UPDATE that permutes serials (e.g. 1,2,3,4 -> 4,3,2,1)
// trips the constraint mid-statement and throws a duplicate-key error. Phase 1
// parks every serial at a guaranteed-unique temporary value (the row's unique
// id), so phase 2 can assign the final sequential serials without any target
// ever colliding with a value still held by another row.
export async function renumberTicketsByDate() {
  await prisma.$transaction([
    prisma.$executeRawUnsafe(`UPDATE "Ticket" SET "serialNo" = '__tmp__' || id::text;`),
    prisma.$executeRawUnsafe(`
      UPDATE "Ticket" AS t
      SET "serialNo" = sub."newSerial"
      FROM (
        SELECT id, CAST(ROW_NUMBER() OVER (ORDER BY "exactDate" ASC, id ASC) AS TEXT) AS "newSerial"
        FROM "Ticket"
      ) AS sub
      WHERE t.id = sub.id;
    `),
  ]);
}

// Finds an existing ticket whose subject matches (ignoring case/leading/trailing
// whitespace) so callers can block duplicate entries regardless of date or sender.
export async function findDuplicateTicketBySubject(subject) {
  const trimmed = (subject || '').trim();
  if (!trimmed) return null;
  return prisma.ticket.findFirst({
    where: { subject: { equals: trimmed, mode: 'insensitive' } },
    select: { id: true, serialNo: true, subject: true, status: true, jobMetadata: { select: { id: true } } },
  });
}
