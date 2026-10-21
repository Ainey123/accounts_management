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
  if (!name) return 'Unassigned';
  const l = name.toLowerCase().trim();
  if (l.includes('rizwan') || l.includes('ali shehzad') || l.includes('ali shezad') || l.includes('batch 1')) return 'Batch No. 01';
  if (l.includes('ibrahim') || l.includes('batch 2')) return 'Batch No. 02';
  if (l.includes('shahzaib') || l.includes('shah zaib') || l.includes('batch 3')) return 'Batch No. 03';
  if (l.includes('sermad') || l.includes('sarmad') || l.includes('batch 4')) return 'Batch No. 04';
  return 'Unassigned';
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

function getUserFromCookie(request) {
  const authCookie = request.headers.get('x-user-id') || request.cookies.get('nexus_user')?.value;
  if (!authCookie) return null;
  try {
    const decoded = typeof authCookie === 'string' ? decodeURIComponent(authCookie) : authCookie;
    return decoded.startsWith('{') ? JSON.parse(decoded) : null;
  } catch {
    return null;
  }
}

export async function GET(request) {
  try {
    const sessionUser = getUserFromCookie(request);
    if (sessionUser && sessionUser.role === 'EMPLOYEE') {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tenureFilter = searchParams.get('tenure') || searchParams.get('month') || 'all';
    const batchFilter = searchParams.get('batch') || 'all';
    const fromDateParam = searchParams.get('fromDate');
    const toDateParam = searchParams.get('toDate');

    const jobs = await withDbRetry(async () => {
      return await prisma.jobMetadata.findMany({
        include: {
          ticket: true,
          assignedEmployee: true,
          createdBy: true,
          quotationInvoices: true,
          payments: true,
          workCompletion: true,
          bankApproval: true,
        },
        orderBy: { createdAt: 'asc' }
      });
    });

    const batchNames = ['Batch No. 01', 'Batch No. 02', 'Batch No. 03', 'Batch No. 04'];

    // Overall Domain Overview Card
    const domainOverview = {
      cardTitle: 'Domain Overview',
      batchName: 'Overall (All Batches)',
      totalComplaints: 0,
      paymentReceivedCases: 0,
      paymentPendingCases: 0,
      poPendingCases: 0,
      inprocessCases: 0,
      cancelCases: 0,
      totalInvoicesSent: { count: 0, amount: 0 },
      totalPaymentsReceived: { count: 0, amount: 0 },
      totalPendingBalance: 0,
    };

    // Batch Cards Map
    const batchCardsMap = {};
    batchNames.forEach(b => {
      batchCardsMap[b] = {
        cardTitle: 'Domain Overview',
        batchName: b,
        totalComplaints: 0,
        paymentReceivedCases: 0,
        paymentPendingCases: 0,
        poPendingCases: 0,
        inprocessCases: 0,
        cancelCases: 0,
        totalInvoicesSent: { count: 0, amount: 0 },
        totalPaymentsReceived: { count: 0, amount: 0 },
        totalPendingBalance: 0,
        inquiryQuestion: `Why are payment pending, PO pending, or inprocess cases delayed for ${b}?`
      };
    });

    // Monthly / Tenure Cards Map
    const tenureCardsMap = {};

    for (const j of jobs) {
      // Check batch
      const rawEmp = j.ticket?.statusLastChangedBy || j.assignedEmployee?.employeeName || j.manualEnteredBy || j.createdBy?.employeeName;
      const bName = mapToBatchName(rawEmp);

      // Do not consider unassigned or admin batch complaints in the operational audit
      if (!batchNames.includes(bName)) {
        continue;
      }

      const rawDate = j.ticket?.exactDate || j.createdAt;
      const dateObj = rawDate ? new Date(rawDate) : null;
      const mKey = dateObj ? dateObj.toISOString().slice(0, 7) : '2026-01';

      if (!tenureCardsMap[mKey]) {
        tenureCardsMap[mKey] = {
          tenureKey: mKey,
          tenureName: MONTH_NAMES[mKey] || mKey,
          cardTitle: 'Domain Overview',
          batchName: `Tenure: ${MONTH_NAMES[mKey] || mKey}`,
          totalComplaints: 0,
          paymentReceivedCases: 0,
          paymentPendingCases: 0,
          poPendingCases: 0,
          inprocessCases: 0,
          cancelCases: 0,
          totalInvoicesSent: { count: 0, amount: 0 },
          totalPaymentsReceived: { count: 0, amount: 0 },
          totalPendingBalance: 0,
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

      const isCancel = j.ticket?.status === 'CANCELLED' || j.workCompletion?.status === 'CANCELLED';
      const isPaymentCleared = (j.paymentStatus === 'PAID' || j.paymentStatus === 'CLEARED' || (j.paymentProgress || 0) >= 100) || (baseAmount > 0 && balanceDue <= 0 && grossPayment > 0);
      const hasPO = invoices.some(i => i.poNumber && i.poNumber.trim()) || quotations.some(q => q.poNumber && q.poNumber.trim());

      // Update Tenure Overview Card
      tc.totalComplaints++;
      if (invoices.length > 0) {
        tc.totalInvoicesSent.count += invoices.length;
        tc.totalInvoicesSent.amount += totalInvoice;
      }
      if (grossPayment > 0) {
        tc.totalPaymentsReceived.count += (j.payments || []).length || 1;
        tc.totalPaymentsReceived.amount += grossPayment;
      }
      tc.totalPendingBalance += balanceDue;

      if (isCancel) {
        tc.cancelCases++;
      } else if (isPaymentCleared) {
        tc.paymentReceivedCases++;
      } else if (invoices.length > 0 || (j.payments || []).length > 0 || j.paymentStatus === 'PARTIAL') {
        tc.paymentPendingCases++;
      } else if (!hasPO && quotations.length > 0) {
        tc.poPendingCases++;
      } else {
        tc.inprocessCases++;
      }

      // If matches active tenure filter, update batchCardsMap & domainOverview
      if (matchesTenure) {
        const bc = batchCardsMap[bName];
        bc.totalComplaints++;
        if (invoices.length > 0) {
          bc.totalInvoicesSent.count += invoices.length;
          bc.totalInvoicesSent.amount += totalInvoice;
        }
        if (grossPayment > 0) {
          bc.totalPaymentsReceived.count += (j.payments || []).length || 1;
          bc.totalPaymentsReceived.amount += grossPayment;
        }
        bc.totalPendingBalance += balanceDue;

        if (isCancel) {
          bc.cancelCases++;
        } else if (isPaymentCleared) {
          bc.paymentReceivedCases++;
        } else if (invoices.length > 0 || (j.payments || []).length > 0 || j.paymentStatus === 'PARTIAL') {
          bc.paymentPendingCases++;
        } else if (!hasPO && quotations.length > 0) {
          bc.poPendingCases++;
        } else {
          bc.inprocessCases++;
        }

        if (matchesBatch) {
          domainOverview.totalComplaints++;
          if (invoices.length > 0) {
            domainOverview.totalInvoicesSent.count += invoices.length;
            domainOverview.totalInvoicesSent.amount += totalInvoice;
          }
          if (grossPayment > 0) {
            domainOverview.totalPaymentsReceived.count += (j.payments || []).length || 1;
            domainOverview.totalPaymentsReceived.amount += grossPayment;
          }
          domainOverview.totalPendingBalance += balanceDue;

          if (isCancel) {
            domainOverview.cancelCases++;
          } else if (isPaymentCleared) {
            domainOverview.paymentReceivedCases++;
          } else if (invoices.length > 0 || (j.payments || []).length > 0 || j.paymentStatus === 'PARTIAL') {
            domainOverview.paymentPendingCases++;
          } else if (!hasPO && quotations.length > 0) {
            domainOverview.poPendingCases++;
          } else {
            domainOverview.inprocessCases++;
          }
        }
      }
    }

    const batchCards = batchNames.map(b => batchCardsMap[b]);
    const tenureCards = Object.keys(tenureCardsMap).sort().map(k => tenureCardsMap[k]);

    return NextResponse.json({
      success: true,
      activeTenure: tenureFilter,
      activeBatch: batchFilter,
      tenureOptions: Object.keys(tenureCardsMap).sort().map(k => ({ key: k, name: MONTH_NAMES[k] || k })),
      batchOptions: batchNames,
      domainOverview,
      batchCards,
      tenureCards,
      downloadUrls: {
        cardsPdf: '/reports/Cards_Summary_Pending_Audit.pdf',
        cardsXlsx: '/reports/Cards_Summary_Pending_Audit.xlsx',
        cardsCsv: '/reports/Cards_Summary_Pending_Audit.csv',
      }
    });
  } catch (error) {
    console.error('Pending checklist Domain Overview API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch domain overview cards', details: error.message },
      { status: 500 }
    );
  }
}
