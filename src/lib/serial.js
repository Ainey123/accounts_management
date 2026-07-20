import { prisma } from '@/lib/prisma';

export async function nextTicketSerialNo() {
  // Find the highest existing serial number (numeric part) mathematically,
  // since database string sorting ('desc') sorts alphabetically (e.g. '9' > '10').
  const tickets = await prisma.ticket.findMany({
    select: { serialNo: true },
  });

  let maxNum = 0;
  for (const t of tickets) {
    if (t.serialNo) {
      const match = t.serialNo.match(/^(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  }

  return String(maxNum + 1);
}
