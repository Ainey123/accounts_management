import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const [
      notEnteredComplaints,
      enteredEmails,
      generatedQuotes,
      approvedQuotations,
      generatedInvoices,
    ] = await Promise.all([
      prisma.ticket.count({ where: { jobMetadata: null } }),
      prisma.ticket.count({ where: { jobMetadata: { isNot: null } } }),
      prisma.quotationInvoice.count({
        where: { documentType: 'QUOTATION' },
      }),
      prisma.quotationInvoice.count({
        where: { documentType: 'QUOTATION', status: 'APPROVED' },
      }),
      prisma.quotationInvoice.count({
        where: { documentType: 'INVOICE' },
      }),
    ]);

    return NextResponse.json({
      stats: {
        notEnteredComplaints,
        enteredEmails,
        generatedQuotes,
        approvedQuotations,
        generatedInvoices,
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
