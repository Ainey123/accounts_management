import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const TAX_RATE = 0.15;

export async function GET() {
  try {
    const [expenses, quotations, invoices] = await Promise.all([
      prisma.expense.findMany({
        include: { jobMetadata: { include: { ticket: true } } },
      }),
      prisma.quotationInvoice.findMany({
        where: { documentType: 'QUOTATION', status: 'APPROVED' },
      }),
      prisma.quotationInvoice.findMany({
        where: { documentType: 'INVOICE' },
      }),
    ]);

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    const revenueFromInvoices = invoices.reduce((sum, inv) => {
      const items = Array.isArray(inv.lineItems) ? inv.lineItems : [];
      const docTotal = items.reduce((s, item) => s + (Number(item.amount) || 0), 0);
      return sum + docTotal;
    }, 0);

    const revenueFromApprovedQuotes = quotations.reduce((sum, q) => {
      const items = Array.isArray(q.lineItems) ? q.lineItems : [];
      const docTotal = items.reduce((s, item) => s + (Number(item.amount) || 0), 0);
      return sum + docTotal;
    }, 0);

    const grossRevenue = revenueFromInvoices + revenueFromApprovedQuotes;
    const taxableIncome = Math.max(0, grossRevenue - totalExpenses);
    const taxDeduction = taxableIncome * TAX_RATE;
    const netCashFlow = grossRevenue - totalExpenses - taxDeduction;

    return NextResponse.json({
      financials: {
        totalExpenses,
        taxDeduction,
        netCashFlow,
        grossRevenue,
        taxRate: TAX_RATE,
      },
      expenses,
      quotations,
      invoices,
    });
  } catch (error) {
    console.error('Financials error:', error);
    return NextResponse.json({ error: 'Failed to fetch financials' }, { status: 500 });
  }
}
