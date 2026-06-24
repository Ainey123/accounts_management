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
        gmailAccount: { select: { id: true, gmailEmail: true } },
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

export async function POST(request) {
  try {
    const { subject, sender } = await request.json();

    if (!subject) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }

    const serialNo = await nextTicketSerialNo();
    const now = new Date();
    const ticket = await prisma.ticket.create({
      data: {
        serialNo,
        subject,
        sender: sender || 'Manual Entry',
        exactDate: now,
        time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        gmailMessageId: `manual-${Date.now()}`,
      },
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    console.error('Ticket create error:', error);
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
  }
}
