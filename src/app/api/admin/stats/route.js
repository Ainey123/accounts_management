import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // ── Global counters ──────────────────────────────────────────────────────
    const [
      notEnteredComplaints,
      enteredEmails,
      generatedQuotes,
      approvedQuotations,
      generatedInvoices,
      relevantCount,
      irrelevantCount,
      cancelledCount,
    ] = await Promise.all([
      prisma.ticket.count({ where: { jobMetadata: null, NOT: { status: { in: ['IRRELEVANT', 'CANCELLED'] } } } }),
      prisma.ticket.count({ where: { jobMetadata: { isNot: null } } }),
      prisma.quotationInvoice.count({ where: { documentType: 'QUOTATION' } }),
      prisma.quotationInvoice.count({ where: { documentType: 'QUOTATION', status: 'APPROVED' } }),
      prisma.quotationInvoice.count({ where: { documentType: 'INVOICE' } }),
      prisma.ticket.count({ where: { status: 'RELEVANT' } }),
      prisma.ticket.count({ where: { status: 'IRRELEVANT' } }),
      prisma.ticket.count({ where: { status: 'CANCELLED' } }),
    ]);

    const totalTickets = await prisma.ticket.count();
    const totalNotEntered = notEnteredComplaints;

    // ── Per-employee Business Card Matrix ────────────────────────────────────
    const employees = await prisma.user.findMany({
      where: { role: 'EMPLOYEE' },
      select: { id: true, employeeName: true },
      orderBy: { employeeName: 'asc' },
    });

    const allJobs = await prisma.jobMetadata.findMany({
      select: {
        id: true,
        assignedEmployeeId: true,
        workCompletion: { select: { status: true } },
        quotationInvoices: { select: { documentType: true, status: true } },
        ticket: { select: { id: true, status: true } },
      },
    });

    const employeeMatrix = employees.map((emp) => {
      const myJobs = allJobs.filter((j) => j.assignedEmployeeId === emp.id);
      const entered = myJobs.length;
      const cancelled = myJobs.filter((j) => j.workCompletion?.status === 'CANCELLED').length;
      const relevant = myJobs.filter((j) => j.ticket?.status === 'RELEVANT').length;
      const invoiceSent = myJobs.filter((j) =>
        (j.quotationInvoices || []).some((qi) => qi.documentType === 'INVOICE')
      ).length;
      const quotationSent = myJobs.filter((j) =>
        (j.quotationInvoices || []).some((qi) => qi.documentType === 'QUOTATION')
      ).length;

      return {
        employeeId: emp.id,
        employeeName: emp.employeeName,
        entered,
        cancelled,
        relevant,
        invoiceSent,
        quotationSent,
      };
    });

    return NextResponse.json({
      stats: {
        notEnteredComplaints,
        enteredEmails,
        generatedQuotes,
        approvedQuotations,
        generatedInvoices,
        totalTickets,
        totalNotEntered,
        relevantCount,
        irrelevantCount,
        cancelledCount,
      },
      employeeMatrix,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
