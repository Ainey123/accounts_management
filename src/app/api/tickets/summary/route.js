import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/tickets/summary
 * Returns aggregated ticket counts by status and workNature (service type).
 * Used by the employee dashboard to show summary cards.
 */
export async function GET() {
  try {
    // All tickets with their jobMetadata workNature and workCompletion status
    const jobs = await prisma.jobMetadata.findMany({
      select: {
        id: true,
        workNature: true,
        paymentStatus: true,
        workCompletion: { select: { status: true } },
        quotationInvoices: { select: { status: true, documentType: true } },
      },
    });

    // Total tickets (jobs with intake done)
    const totalTickets = await prisma.ticket.count();
    const totalIntake = jobs.length;

    // Determine job-level status
    const summary = {
      total: totalTickets,
      inProcess: 0,
      cancelled: 0,
      completed: 0,
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

      if (jobStatus === 'COMPLETED') {
        summary.completed++;
        bucket.completed++;
      } else if (jobStatus === 'CANCELLED') {
        summary.cancelled++;
        bucket.cancelled++;
      } else {
        summary.inProcess++;
        bucket.inProcess++;
      }
    }

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Ticket summary error:', error);
    return NextResponse.json({ error: 'Failed to fetch ticket summary' }, { status: 500 });
  }
}
