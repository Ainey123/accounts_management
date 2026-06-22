import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const WORK_NATURES = ['ELECTRICAL', 'WAPDA', 'MAINTENANCE', 'PROJECT'];

export async function GET() {
  try {
    const jobs = await prisma.jobMetadata.findMany({
      orderBy: { id: 'desc' },
      include: {
        ticket: true,
        assignedEmployee: { select: { id: true, employeeName: true, email: true } },
        surveyReport: { select: { id: true } },
        quotationInvoices: { select: { id: true, documentType: true, status: true } },
        expenses: { select: { id: true, amount: true } },
      },
    });
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('Jobs fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { ticketId, clientName, branchName, personOfContact, workNature, assignedEmployeeId } =
      await request.json();

    if (!ticketId || !clientName || !branchName || !personOfContact || !workNature) {
      return NextResponse.json({ error: 'All job metadata fields are required' }, { status: 400 });
    }

    if (!WORK_NATURES.includes(workNature)) {
      return NextResponse.json({ error: 'Invalid work nature' }, { status: 400 });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: Number(ticketId) },
      include: { jobMetadata: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }
    if (ticket.jobMetadata) {
      return NextResponse.json({ error: 'Ticket already has job metadata' }, { status: 409 });
    }

    const job = await prisma.jobMetadata.create({
      data: {
        ticketId: Number(ticketId),
        clientName,
        branchName,
        personOfContact,
        workNature,
        assignedEmployeeId: assignedEmployeeId ? Number(assignedEmployeeId) : null,
      },
      include: {
        ticket: true,
        assignedEmployee: { select: { id: true, employeeName: true, email: true } },
      },
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    console.error('Job create error:', error);
    return NextResponse.json({ error: 'Failed to create job metadata' }, { status: 500 });
  }
}
