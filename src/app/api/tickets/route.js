import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nextTicketSerialNo } from '@/lib/serial';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const pending = searchParams.get('pending') === 'true';

    const tickets = await prisma.ticket.findMany({
      where: pending ? { jobMetadata: null } : undefined,
      orderBy: { id: 'desc' },
      include: {
        jobMetadata: {
          include: {
            assignedEmployee: { select: { id: true, employeeName: true, email: true } },
          },
        },
      },
    });

    return NextResponse.json({ tickets });
  } catch (error) {
    console.error('Tickets fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
  }
}
