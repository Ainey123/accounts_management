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
    ] = await Promise.all([
      prisma.ticket.count({ where: { jobMetadata: null } }),
      prisma.ticket.count({ where: { jobMetadata: { isNot: null } } }),
      prisma.quotationInvoice.count({ where: { documentType: 'QUOTATION' } }),
      prisma.quotationInvoice.count({ where: { documentType: 'QUOTATION', status: 'APPROVED' } }),
      prisma.quotationInvoice.count({ where: { documentType: 'INVOICE' } }),
    ]);

    // ── Per-employee Business Card Matrix ────────────────────────────────────
    // Fetch all employees
    const employees = await prisma.user.findMany({
      where: { role: 'EMPLOYEE' },
      select: { id: true, employeeName: true },
      orderBy: { employeeName: 'asc' },
    });

    // Total tickets count (not entered = no jobMetadata)
    const totalTickets = await prisma.ticket.count();
    const totalEntered = await prisma.ticket.count({ where: { jobMetadata: { isNot: null } } });
    const totalNotEntered = totalTickets - totalEntered;

    // Fetch all jobs with their related data for per-employee breakdown
    const allJobs = await prisma.jobMetadata.findMany({
      select: {
        id: true,
        assignedEmployeeId: true,
        workCompletion: { select: { status: true } },
        quotationInvoices: { select: { documentType: true, status: true } },
        ticket: { select: { id: true, status: true } },
      },
    });

    // All tickets for RELEVANT status
    const allTickets = await prisma.ticket.findMany({
      select: {
        id: true,
        status: true,
        jobMetadata: {
          select: {
            assignedEmployeeId: true,
            workCompletion: { select: { status: true } },
            quotationInvoices: { select: { documentType: true } },
          },
        },
      },
    });

    // Build per-employee matrix
    const employeeMatrix = employees.map((emp) => {
      // Jobs assigned to this employee
      const myJobs = allJobs.filter((j) => j.assignedEmployeeId === emp.id);

      const entered = myJobs.length;

      const cancelled = myJobs.filter(
        (j) => j.workCompletion?.status === 'CANCELLED'
      ).length;

      const relevant = myJobs.filter(
        (j) => j.ticket?.status === 'RELEVANT'
      ).length;

      const invoiceSent = myJobs.filter((j) =>
        (j.quotationInvoices || []).some((qi) => qi.documentType === 'INVOICE')
      ).length;

      const quotationSent = myJobs.filter((j) =>
        (j.quotationInvoices || []).some((qi) => qi.documentType === 'QUOTATION')
      ).length;

      // "Not entered" tickets that have this employee in context is N/A per-employee
      // (not entered means no job yet → no assignedEmployee). Show global not-entered for reference.
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
      },
      employeeMatrix,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
