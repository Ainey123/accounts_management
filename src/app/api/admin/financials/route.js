import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const TAX_RATE = 0.15;

export async function GET() {
  try {
    const [expenses, quotations, invoices, payments, workCompletions, jobsWithProgress] = await Promise.all([
      prisma.expense.findMany({
        include: { jobMetadata: { include: { ticket: true } } },
      }),
      prisma.quotationInvoice.findMany({
        where: { documentType: 'QUOTATION', status: 'APPROVED' },
      }),
      prisma.quotationInvoice.findMany({
        where: { documentType: 'INVOICE' },
      }),
      prisma.paymentReceived.findMany({
        include: {
          createdBy: { select: { id: true, employeeName: true, email: true } },
          jobMetadata: { include: { ticket: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.workCompletion.findMany({
        where: { status: 'COMPLETED' },
      }),
      prisma.jobMetadata.findMany({
        include: { ticket: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const parseLineItems = (lineItemsField) => {
      if (!lineItemsField) return [];
      if (Array.isArray(lineItemsField)) return lineItemsField;
      if (typeof lineItemsField === 'string') {
        try {
          return JSON.parse(lineItemsField);
        } catch (e) {
          console.error('Failed to parse line items JSON string:', e);
          return [];
        }
      }
      return [];
    };

    const revenueFromInvoices = invoices.reduce((sum, inv) => {
      const items = parseLineItems(inv.lineItems);
      const docTotal = items.reduce((s, item) => s + (Number(item.amount) || 0), 0);
      return sum + docTotal;
    }, 0);

    const totalBusiness = workCompletions.reduce((sum, wc) => sum + (Number(wc.amount) || 0), 0);
    const totalReceivable = revenueFromInvoices;
    const totalReceived = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const taxDeduction = payments.reduce((sum, p) => sum + (p.taxDeducted || 0), 0);
    
    const profitOrLoss = totalReceived - totalExpenses - taxDeduction; // Cash flow profit/loss

    const avgPaymentProgress = jobsWithProgress.length > 0
      ? Math.round(jobsWithProgress.reduce((sum, j) => sum + (j.paymentProgress || 0), 0) / jobsWithProgress.length)
      : 0;

    const jobsByProgress = {
      notStarted: jobsWithProgress.filter(j => (j.paymentProgress || 0) === 0).length,
      partial: jobsWithProgress.filter(j => (j.paymentProgress || 0) > 0 && (j.paymentProgress || 0) < 100).length,
      fullyPaid: jobsWithProgress.filter(j => (j.paymentProgress || 0) === 100).length,
    };

    return NextResponse.json({
      financials: {
        totalBusiness,
        totalReceivable,
        totalReceived,
        totalExpenses,
        taxDeduction,
        profitOrLoss,
        isProfit: profitOrLoss >= 0,
        avgPaymentProgress,
        jobsByProgress,
      },
      expenses,
      quotations,
      invoices,
      payments,
      jobsWithProgress,
    });
  } catch (error) {
    console.error('Financials error:', error);
    return NextResponse.json({ error: 'Failed to fetch financials' }, { status: 500 });
  }
}
