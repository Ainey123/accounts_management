import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/tickets/summary
 * Returns aggregated ticket counts by status and workNature (service type).
 * Used by the employee dashboard to show summary cards.
 */
export async function GET(request) {
  try {
    const authCookie = request.cookies.get('nexus_user');
    let user = null;
    if (authCookie) {
      try {
        user = JSON.parse(authCookie.value);
      } catch (e) {}
    }

    // All tickets with their jobMetadata workNature and workCompletion status
    const jobs = await prisma.jobMetadata.findMany({
      select: {
        id: true,
        workNature: true,
        paymentStatus: true,
        assignedEmployeeId: true,
        workCompletion: { select: { status: true } },
        quotationInvoices: { select: { status: true, documentType: true } },
      },
    });

    // Total tickets (jobs with intake done)
    const totalTickets = await prisma.ticket.count();
    const totalIntake = jobs.length;

    // Total tickets count by status
    const [relevantCount, irrelevantCount, cancelledCount] = await Promise.all([
      prisma.ticket.count({ where: { status: 'RELEVANT' } }),
      prisma.ticket.count({ where: { status: 'IRRELEVANT' } }),
      prisma.ticket.count({ where: { status: 'CANCELLED' } }),
    ]);

    // Determine job-level status
    const summary = {
      total: totalTickets,
      inProcess: 0,
      cancelled: 0,
      completed: 0,
      relevant: relevantCount,
      irrelevant: irrelevantCount,
      cancelledTickets: cancelledCount,
      byNature: {
        WAPDA: { inProcess: 0, cancelled: 0, completed: 0 },
        ELECTRICAL: { inProcess: 0, cancelled: 0, completed: 0 },
        MAINTENANCE: { inProcess: 0, cancelled: 0, completed: 0 },
        PROJECT: { inProcess: 0, cancelled: 0, completed: 0 },
      },
    };

    for (const job of jobs) {
      const wc = job.workCompletion?.status;
      const nature = job.workNature || 'MAINTENANCE';
      const bucket = summary.byNature[nature] || summary.byNature['MAINTENANCE'];

      let jobStatus = 'IN_PROCESS';
      if (wc === 'COMPLETED') {
        jobStatus = 'COMPLETED';
      } else if (wc === 'CANCELLED') {
        jobStatus = 'CANCELLED';
      }

      // Add to global totals
      if (jobStatus === 'COMPLETED') {
        summary.completed++;
      } else if (jobStatus === 'CANCELLED') {
        summary.cancelled++;
      } else {
        summary.inProcess++;
      }

      // Add to individual breakdown ONLY if admin or assigned to this employee
      const shouldIncludeInBreakdown = user?.role === 'ADMIN' || job.assignedEmployeeId === user?.id;
      if (shouldIncludeInBreakdown) {
        if (jobStatus === 'COMPLETED') {
          bucket.completed++;
        } else if (jobStatus === 'CANCELLED') {
          bucket.cancelled++;
        } else {
          bucket.inProcess++;
        }
      }
    }

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Ticket summary error:', error);
    return NextResponse.json({ error: 'Failed to fetch ticket summary' }, { status: 500 });
  }
}
