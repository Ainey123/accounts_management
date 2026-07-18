import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const TAX_RATE = 0.15;

export async function GET() {
  try {
    let expenses = [];
    try {
      expenses = await prisma.expense.findMany({
        include: { jobMetadata: { include: { ticket: true } } },
      });
    } catch (err) {
      console.error("Financials API - failed to fetch expenses with full include:", err.message);
      try {
        expenses = await prisma.expense.findMany({ include: { jobMetadata: true } });
      } catch (err2) {
        console.error("Financials API - failed to fetch expenses fallback:", err2.message);
        try {
          expenses = await prisma.expense.findMany();
        } catch (err3) {
          console.error("Financials API - failed to fetch expenses minimal:", err3.message);
        }
      }
    }

    let quotations = [];
    try {
      quotations = await prisma.quotationInvoice.findMany({
        where: { documentType: 'QUOTATION', status: 'APPROVED' },
      });
    } catch (err) {
      console.error("Financials API - failed to fetch quotations:", err.message);
    }

    let invoices = [];
    try {
      invoices = await prisma.quotationInvoice.findMany({
        where: { documentType: 'INVOICE' },
      });
    } catch (err) {
      console.error("Financials API - failed to fetch invoices:", err.message);
    }

    let payments = [];
    try {
      payments = await prisma.paymentReceived.findMany({
        include: {
          createdBy: { select: { id: true, employeeName: true, email: true } },
          jobMetadata: { include: { ticket: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (err) {
      console.error("Financials API - failed to fetch payments with full include:", err.message);
      try {
        payments = await prisma.paymentReceived.findMany({
          include: { jobMetadata: true },
          orderBy: { createdAt: 'desc' },
        });
      } catch (err2) {
        console.error("Financials API - failed to fetch payments fallback:", err2.message);
        try {
          payments = await prisma.paymentReceived.findMany({ orderBy: { createdAt: 'desc' } });
        } catch (err3) {
          console.error("Financials API - failed to fetch payments minimal:", err3.message);
        }
      }
    }

    let workCompletions = [];
    try {
      workCompletions = await prisma.workCompletion.findMany({
        where: { status: 'COMPLETED' },
      });
    } catch (err) {
      console.error("Financials API - failed to fetch workCompletions:", err.message);
    }

    let jobsWithProgress = [];
    try {
      jobsWithProgress = await prisma.jobMetadata.findMany({
        include: { ticket: true },
        orderBy: { createdAt: 'desc' },
      });
    } catch (err) {
      console.error("Financials API - failed to fetch jobsWithProgress with include:", err.message);
      try {
        jobsWithProgress = await prisma.jobMetadata.findMany({
          orderBy: { createdAt: 'desc' },
        });
      } catch (err2) {
        console.error("Financials API - failed to fetch jobsWithProgress minimal:", err2.message);
      }
    }

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
