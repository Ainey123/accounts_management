import { prisma } from '@/lib/prisma';

export async function nextTicketSerialNo() {
  const maxTicket = await prisma.ticket.findFirst({
    orderBy: { id: 'desc' },
    select: { serialNo: true },
  });

  const extractSerialNum = (serial) => {
    if (!serial) return 0;
    const match = serial.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const num = extractSerialNum(maxTicket?.serialNo);
  return String(num + 1);
}

// Renumbers every ticket's serialNo as 1, 2, 3... ordered by the actual email/entry
// date (exactDate), oldest first — so a January email is always serial 1 and the
// most recent ticket always carries the highest serial, regardless of the order
// tickets were synced/inserted in.
export async function renumberTicketsByDate() {
  await prisma.$executeRawUnsafe(`
    UPDATE "Ticket" AS t
    SET "serialNo" = sub."newSerial"
    FROM (
      SELECT id, CAST(ROW_NUMBER() OVER (ORDER BY "exactDate" ASC, id ASC) AS TEXT) AS "newSerial"
      FROM "Ticket"
    ) AS sub
    WHERE t.id = sub.id;
  `);
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
