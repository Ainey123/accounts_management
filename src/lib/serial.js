import { prisma } from '@/lib/prisma';

export async function nextTicketSerialNo() {
  const maxTicket = await prisma.ticket.findFirst({
    orderBy: { id: 'desc' },
    select: { serialNo: true },
  });
  
  const extractSerialNum = (serial) => {
    if (!serial) return 0;
    const match = serial.match(/^#(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };
  
  const num = extractSerialNum(maxTicket?.serialNo);
  return `#${String(num + 1).padStart(3, '0')}`;
}
