import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nextTicketSerialNo, renumberTicketsByDate, findDuplicateTicketBySubject } from '@/lib/serial';

async function withRetry(fn, retries = 3, delay = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === retries - 1) throw e;
      if (e.message?.includes('max clients reached') || e.code?.includes('EMAXCONNSESSION')) {
        await new Promise(r => setTimeout(r, delay * (i + 1)));
        continue;
      }
      throw e;
    }
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const pending = searchParams.get('pending') === 'true';

    const tickets = await withRetry(() => prisma.ticket.findMany({
      where: pending ? { jobMetadata: null } : undefined,
      orderBy: { exactDate: 'desc' },
      include: {
        gmailAccount: { select: { id: true, gmailEmail: true } },
        createdBy: { select: { id: true, employeeName: true, email: true } },
        jobMetadata: {
          include: {
            assignedEmployee: { select: { id: true, employeeName: true, email: true } },
            createdBy: { select: { id: true, employeeName: true, email: true } },
          },
        },
      },
    }));

    return NextResponse.json({ tickets });
  } catch (error) {
    console.error('Tickets fetch error:', error);
    const message = error.message || 'Unknown error';
    const code = error.code || '';
    const meta = error.meta || {};
    return NextResponse.json({ error: 'Failed to fetch tickets', details: message, code, meta: JSON.stringify(meta) }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { subject, sender, createdById } = await request.json();

    if (!subject) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }

    const duplicate = await withRetry(() => findDuplicateTicketBySubject(subject));
    if (duplicate) {
      return NextResponse.json(
        { error: `Job already intake — a ticket with this subject already exists (Serial #${duplicate.serialNo}).` },
        { status: 409 }
      );
    }

    const serialNo = await withRetry(() => nextTicketSerialNo());
    const now = new Date();
    const created = await withRetry(() => prisma.ticket.create({
      data: {
        serialNo,
        subject,
        sender: sender || 'Manual Entry',
        exactDate: now,
        time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        gmailMessageId: `manual-${Date.now()}`,
        createdById: createdById ? Number(createdById) : undefined,
        status: 'RELEVANT',
      },
    }));

    // Re-rank all serials chronologically by exactDate so the register always
    // reads Jan -> now in ascending, gap-free serial order.
    await withRetry(() => renumberTicketsByDate());

    const ticket = await withRetry(() => prisma.ticket.findUnique({
      where: { id: created.id },
      include: {
        createdBy: { select: { id: true, employeeName: true, email: true } },
      },
    }));

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    console.error('Ticket create error:', error);
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
  }
}