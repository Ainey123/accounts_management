import { prisma } from '@/lib/prisma';

export async function nextTicketSerialNo() {
  const count = await prisma.ticket.count();
  return `#${String(count + 1).padStart(3, '0')}`;
}
