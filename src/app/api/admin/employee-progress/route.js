import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function getTicketEntryPerson(ticket) {
  return (
    ticket.statusLastChangedBy ||
    ticket.jobMetadata?.assignedEmployee?.employeeName ||
    ticket.jobMetadata?.createdBy?.employeeName ||
    ticket.jobMetadata?.manualEnteredBy ||
    'Unassigned / Auto-Ingested'
  );
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const monthParam = searchParams.get('month'); // format: YYYY-MM

    let startDate;
    let endDate;

    if (fromParam && toParam) {
      startDate = new Date(`${fromParam}T00:00:00.000Z`);
      endDate = new Date(`${toParam}T23:59:59.999Z`);
    } else if (monthParam) {
      const [yearStr, monthStr] = monthParam.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10) - 1; // 0-indexed
      startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
    } else {
      // Default to current month or August 2026 if current has no data
      const now = new Date();
      startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
    }

    const tickets = await prisma.ticket.findMany({
      where: {
        exactDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        jobMetadata: {
          include: {
            assignedEmployee: {
              select: { id: true, employeeName: true, email: true },
            },
            createdBy: {
              select: { id: true, employeeName: true, email: true },
            },
          },
        },
        createdBy: {
          select: { id: true, employeeName: true, email: true },
        },
      },
      orderBy: {
        exactDate: 'asc',
      },
    });

    const employees = await prisma.user.findMany({
      where: { role: 'EMPLOYEE' },
      select: { id: true, employeeName: true, email: true, activeStatus: true },
      orderBy: { employeeName: 'asc' },
    });

    // Map each ticket with its entry person
    const mappedTickets = tickets.map((t) => ({
      id: t.id,
      serialNo: t.serialNo,
      exactDate: t.exactDate,
      time: t.time,
      sender: t.sender,
      subject: t.subject,
      status: t.status,
      statusLastChangedBy: t.statusLastChangedBy,
      entryPerson: getTicketEntryPerson(t),
      jobMetadata: t.jobMetadata
        ? {
            id: t.jobMetadata.id,
            clientName: t.jobMetadata.clientName,
            branchName: t.jobMetadata.branchName,
            personOfContact: t.jobMetadata.personOfContact,
            workNature: t.jobMetadata.workNature,
            assignedEmployee: t.jobMetadata.assignedEmployee?.employeeName || null,
          }
        : null,
    }));

    return NextResponse.json({
      success: true,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalTickets: mappedTickets.length,
      employees,
      tickets: mappedTickets,
    });
  } catch (error) {
    console.error('Error in employee progress API:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch employee progress' }, { status: 500 });
  }
}
