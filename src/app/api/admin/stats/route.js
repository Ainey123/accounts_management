import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const [
      pendingTickets,
      intakeForms,
      surveys,
      pendingQuotations,
      pendingInvoices,
      approvedQuotations,
    ] = await Promise.all([
      prisma.ticket.count({ where: { jobMetadata: null } }),
      prisma.jobMetadata.count(),
      prisma.surveyReport.count(),
      prisma.quotationInvoice.count({
        where: { documentType: 'QUOTATION', status: 'PENDING' },
      }),
      prisma.quotationInvoice.count({
        where: { documentType: 'INVOICE', status: 'PENDING' },
      }),
      prisma.quotationInvoice.count({
        where: { documentType: 'QUOTATION', status: 'APPROVED' },
      }),
    ]);

    return NextResponse.json({
      stats: {
        pendingTickets,
        intakeForms,
        surveys,
        pendingQuotations,
        pendingInvoices,
        approvedQuotations,
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
