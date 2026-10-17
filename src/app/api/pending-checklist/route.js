import { NextResponse } from 'next/server';
import { prisma, withDbRetry } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const MONTH_NAMES = {
  '2026-01': 'January 2026',
  '2026-02': 'February 2026',
  '2026-03': 'March 2026',
  '2026-04': 'April 2026',
  '2026-05': 'May 2026',
  '2026-06': 'June 2026',
  '2026-07': 'July 2026',
  '2026-08': 'August 2026',
  '2026-09': 'September 2026',
  '2026-10': 'October 2026',
};

function mapToBatchName(name) {
  if (!name) return 'Unassigned / Office';
  const l = name.toLowerCase().trim();
  if (l.includes('rizwan') || l.includes('ali shehzad') || l.includes('ali shezad') || l.includes('batch 1')) return 'Batch 1';
  if (l.includes('ibrahim') || l.includes('batch 2')) return 'Batch 2';
  if (l.includes('shahzaib') || l.includes('shah zaib') || l.includes('batch 3')) return 'Batch 3';
  if (l.includes('sermad') || l.includes('sarmad') || l.includes('batch 4')) return 'Batch 4';
  return 'Unassigned / Office';
}

function parseLineItemsTotal(lineItems) {
  if (!lineItems) return 0;
  try {
    const items = typeof lineItems === 'string' ? JSON.parse(lineItems) : lineItems;
    if (Array.isArray(items)) {
      return items.reduce((sum, it) => sum + (Number(it.amount) || ((Number(it.qty) || 0) * (Number(it.rate) || 0)) || 0), 0);
    }
  } catch {}
  return 0;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenureFilter = searchParams.get('tenure') || searchParams.get('month') || 'all'; // 'all' or '2026-01', etc.
    const batchFilter = searchParams.get('batch') || 'all';
    const fromDateParam = searchParams.get('fromDate');
    const toDateParam = searchParams.get('toDate');

    const jobs = await withDbRetry(async () => {
      return await prisma.jobMetadata.findMany({
        select: {
          id: true,
          manualEnteredBy: true,
          createdAt: true,
          paymentProgress: true,
          paymentStatus: true,
          ticket: {
            select: {
              id: true,
              serialNo: true,
              exactDate: true,
              statusLastChangedBy: true,
            }
          },
          assignedEmployee: { select: { employeeName: true } },
          createdBy: { select: { employeeName: true } },
          quotationInvoices: {
            select: {
              id: true,
              documentType: true,
              status: true,
              lineItems: true,
            }
          },
          payments: {
            select: {
              id: true,
              amount: true,
              taxDeducted: true,
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      });
    });

    const batchNames = ['Batch 1', 'Batch 2', 'Batch 3', 'Batch 4', 'Unassigned / Office'];
    
    // Overall Cards Container
    const overallCards = {
      totalJobs: 0,
      invoicesSent: { count: 0, amount: 0 },
      invoicesPending: { count: 0, amount: 0 },
      paymentsSent: { count: 0, amount: 0 },
      paymentsPending: { count: 0, amount: 0 },
      recoveryRate: '0.0'
    };

    // Batch Cards Map
    const batchCardsMap = {};
    batchNames.forEach(b => {
      batchCardsMap[b] = {
        batchName: b,
        totalJobs: 0,
        invoicesSent: { count: 0, amount: 0 },
        invoicesPending: { count: 0, amount: 0 },
        paymentsSent: { count: 0, amount: 0 },
        paymentsPending: { count: 0, amount: 0 },
        sampleSerials: []
      };
    });

    // Monthly / Tenure Cards Map
    const tenureCardsMap = {};

    for (const j of jobs) {
      const rawDate = j.ticket?.exactDate || j.createdAt;
      const dateObj = rawDate ? new Date(rawDate) : null;
      const mKey = dateObj ? dateObj.toISOString().slice(0, 7) : '2026-01';

      if (!tenureCardsMap[mKey]) {
        tenureCardsMap[mKey] = {
          tenureKey: mKey,
          tenureName: MONTH_NAMES[mKey] || mKey,
          totalJobs: 0,
          invoicesSent: { count: 0, amount: 0 },
          invoicesPending: { count: 0, amount: 0 },
          paymentsSent: { count: 0, amount: 0 },
          paymentsPending: { count: 0, amount: 0 },
        };
      }

      const tc = tenureCardsMap[mKey];

      // Check tenure filters
      let matchesTenure = true;
      if (tenureFilter && tenureFilter !== 'all') {
        matchesTenure = (mKey === tenureFilter);
      }
      if (fromDateParam && dateObj) {
        if (dateObj < new Date(fromDateParam)) matchesTenure = false;
      }
      if (toDateParam && dateObj) {
        if (dateObj > new Date(toDateParam + 'T23:59:59.999Z')) matchesTenure = false;
      }

      // Check batch mapping
      const rawEmp = j.ticket?.statusLastChangedBy || j.assignedEmployee?.employeeName || j.manualEnteredBy || j.createdBy?.employeeName;
      const bName = mapToBatchName(rawEmp);

      let matchesBatch = true;
      if (batchFilter && batchFilter !== 'all') {
        matchesBatch = (bName === batchFilter);
      }

      const invoices = (j.quotationInvoices || []).filter(q => q.documentType === 'INVOICE');
      const quotations = (j.quotationInvoices || []).filter(q => q.documentType === 'QUOTATION');

      const totalInvoice = invoices.reduce((s, inv) => s + parseLineItemsTotal(inv.lineItems), 0);
      const totalQuotation = quotations.reduce((s, q) => s + parseLineItemsTotal(q.lineItems), 0);
      const netReceived = (j.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const taxDeducted = (j.payments || []).reduce((s, p) => s + (Number(p.taxDeducted) || 0), 0);
      const grossPayment = netReceived + taxDeducted;

      const baseAmount = totalInvoice > 0 ? totalInvoice : totalQuotation;
      const balanceDue = Math.max(0, baseAmount - grossPayment);

      const hasApprovedInvoice = invoices.some(i => i.status === 'APPROVED' || i.status === 'PAID');
      const isInvoicePending = invoices.length === 0 || !hasApprovedInvoice;
      const isPaymentPending = (j.paymentStatus !== 'PAID') || balanceDue > 0;

      // Always populate monthly overview cards
      tc.totalJobs++;
      if (invoices.length > 0) {
        tc.invoicesSent.count += invoices.length;
        tc.invoicesSent.amount += totalInvoice;
      }
      if (isInvoicePending) {
        tc.invoicesPending.count++;
        tc.invoicesPending.amount += (totalInvoice === 0 ? totalQuotation : 0);
      }
      if (grossPayment > 0) {
        tc.paymentsSent.count += (j.payments || []).length || 1;
        tc.paymentsSent.amount += grossPayment;
      }
      if (isPaymentPending) {
        tc.paymentsPending.count++;
        tc.paymentsPending.amount += balanceDue;
      }

      // If matches active tenure & batch filter, aggregate into overallCards & batchCardsMap
      if (matchesTenure) {
        const bc = batchCardsMap[bName];
        bc.totalJobs++;

        if (invoices.length > 0) {
          bc.invoicesSent.count += invoices.length;
          bc.invoicesSent.amount += totalInvoice;
        }
        if (isInvoicePending) {
          bc.invoicesPending.count++;
          bc.invoicesPending.amount += (totalInvoice === 0 ? totalQuotation : 0);
        }
        if (grossPayment > 0) {
          bc.paymentsSent.count += (j.payments || []).length || 1;
          bc.paymentsSent.amount += grossPayment;
        }
        if (isPaymentPending) {
          bc.paymentsPending.count++;
          bc.paymentsPending.amount += balanceDue;
        }
        if (bc.sampleSerials.length < 5 && j.ticket?.serialNo) {
          bc.sampleSerials.push(j.ticket.serialNo);
        }

        if (matchesBatch) {
          overallCards.totalJobs++;
          if (invoices.length > 0) {
            overallCards.invoicesSent.count += invoices.length;
            overallCards.invoicesSent.amount += totalInvoice;
          }
          if (isInvoicePending) {
            overallCards.invoicesPending.count++;
            overallCards.invoicesPending.amount += (totalInvoice === 0 ? totalQuotation : 0);
          }
          if (grossPayment > 0) {
            overallCards.paymentsSent.count += (j.payments || []).length || 1;
            overallCards.paymentsSent.amount += grossPayment;
          }
          if (isPaymentPending) {
            overallCards.paymentsPending.count++;
            overallCards.paymentsPending.amount += balanceDue;
          }
        }
      }
    }

    if (overallCards.invoicesSent.amount > 0) {
      overallCards.recoveryRate = ((overallCards.paymentsSent.amount / overallCards.invoicesSent.amount) * 100).toFixed(1);
    }

    // Format Batch Cards Array with inquiry prompts
    const batchCards = batchNames.map(b => {
      const card = batchCardsMap[b];
      return {
        ...card,
        invoicesSent: { count: card.invoicesSent.count, amount: Math.round(card.invoicesSent.amount) },
        invoicesPending: { count: card.invoicesPending.count, amount: Math.round(card.invoicesPending.amount) },
        paymentsSent: { count: card.paymentsSent.count, amount: Math.round(card.paymentsSent.amount) },
        paymentsPending: { count: card.paymentsPending.count, amount: Math.round(card.paymentsPending.amount) },
        inquiryQuestion: `Why does ${card.batchName} have ${card.invoicesPending.count} invoices pending and Rs. ${Math.round(card.paymentsPending.amount).toLocaleString()} payments uncollected for this tenure?`
      };
    });

    const tenureCards = Object.keys(tenureCardsMap).sort().map(k => {
      const tc = tenureCardsMap[k];
      return {
        ...tc,
        invoicesSent: { count: tc.invoicesSent.count, amount: Math.round(tc.invoicesSent.amount) },
        invoicesPending: { count: tc.invoicesPending.count, amount: Math.round(tc.invoicesPending.amount) },
        paymentsSent: { count: tc.paymentsSent.count, amount: Math.round(tc.paymentsSent.amount) },
        paymentsPending: { count: tc.paymentsPending.count, amount: Math.round(tc.paymentsPending.amount) },
      };
    });

    return NextResponse.json({
      success: true,
      activeTenure: tenureFilter,
      activeBatch: batchFilter,
      tenureOptions: Object.keys(tenureCardsMap).sort().map(k => ({ key: k, name: MONTH_NAMES[k] || k })),
      batchOptions: batchNames,
      overallCards: {
        totalJobs: overallCards.totalJobs,
        invoicesSent: { count: overallCards.invoicesSent.count, amount: Math.round(overallCards.invoicesSent.amount) },
        invoicesPending: { count: overallCards.invoicesPending.count, amount: Math.round(overallCards.invoicesPending.amount) },
        paymentsSent: { count: overallCards.paymentsSent.count, amount: Math.round(overallCards.paymentsSent.amount) },
        paymentsPending: { count: overallCards.paymentsPending.count, amount: Math.round(overallCards.paymentsPending.amount) },
        recoveryRate: `${overallCards.recoveryRate}%`
      },
      batchCards,
      tenureCards,
      downloadUrls: {
        cardsPdf: '/reports/Cards_Summary_Pending_Audit.pdf',
        cardsXlsx: '/reports/Cards_Summary_Pending_Audit.xlsx',
        cardsCsv: '/reports/Cards_Summary_Pending_Audit.csv',
        fullPdf: '/reports/All_Months_Pending_Payments_and_Invoices_Checklist.pdf',
        fullXlsx: '/reports/All_Months_Pending_Payments_and_Invoices_Checklist.xlsx',
      }
    });
  } catch (error) {
    console.error('Pending checklist cards API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch cards summary', details: error.message },
      { status: 500 }
    );
  }
}
