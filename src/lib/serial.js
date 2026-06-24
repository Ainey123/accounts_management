import { prisma } from '@/lib/prisma';

export async function nextTicketSerialNo() {
  const maxTicket = await prisma.ticket.findFirst({
    orderBy: { id: 'desc' },
    select: { serialNo: true },
  });
  const current = maxTicket?.serialNo || '#000';
  const num = parseInt(current.replace('#', ''), 10) || 0;
  return `#${String(num + 1).padStart(3, '0')}`;
}
