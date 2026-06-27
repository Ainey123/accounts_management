import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const TAX_RATE = 0.15;

export async function GET() {
  try {
    const [expenses, quotations, invoices, payments] = await Promise.all([
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

    const totalBusiness = revenueFromInvoices;
    const totalReceived = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    
    // Tax deducted is now manually entered by employees for each payment
    const taxDeduction = payments.reduce((sum, p) => sum + (p.taxDeducted || 0), 0);
    
    const netTotalBusiness = totalBusiness - taxDeduction;
    const profitOrLoss = totalReceived - totalExpenses; // Cash flow profit/loss

    return NextResponse.json({
      financials: {
        totalExpenses,
        totalInvoicesSent: revenueFromInvoices,
        invoicesCount: invoices.length,
        totalBusiness,
        totalReceived,
        profitOrLoss,
        isProfit: profitOrLoss >= 0,
        taxDeduction,
        netTotalBusiness,
      },
      expenses,
      quotations,
      invoices,
      payments,
    });
  } catch (error) {
    console.error('Financials error:', error);
    return NextResponse.json({ error: 'Failed to fetch financials' }, { status: 500 });
  }
}
