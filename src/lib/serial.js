import { prisma } from '@/lib/prisma';

export async function nextTicketSerialNo() {
  // Find the highest existing serial number (numeric part) and increment it.
  // Serial numbers are stored as strings; they may contain non‑numeric prefixes.
  const maxTicket = await prisma.ticket.findFirst({
    orderBy: { serialNo: 'desc' },
    select: { serialNo: true },
  });

  const extractSerialNum = (serial) => {
    if (!serial) return 0;
    // Extract leading digits (e.g., "123", "00123", "123‑ABC")
    const match = serial.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const num = extractSerialNum(maxTicket?.serialNo);
  return String(num + 1);
}
