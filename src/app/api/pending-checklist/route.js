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

function normalizeEmployeeName(name) {
  if (!name) return 'Unassigned';
  const lower = name.toLowerCase().trim();
  if (lower.includes('rizwan') || lower.includes('ali shehzad') || lower.includes('ali shezad')) return 'Ali Shehzad / Rizwan (Batch 1)';
  if (lower.includes('ibrahim')) return 'Muhammad Ibrahim (Batch 2)';
  if (lower.includes('shahzaib') || lower.includes('shah zaib')) return 'Shah Zaib (Batch 3)';
  if (lower.includes('sermad') || lower.includes('sarmad')) return 'Sarmad Islam (Batch 4)';
  if (lower.includes('admin') || lower.includes('fatma')) return 'Admin Office';
  return name.trim();
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthFilter = searchParams.get('month') || 'all'; // 'all' or '2026-01', etc.
    const employeeFilter = searchParams.get('employee') || 'all';
    const pendingTypeFilter = searchParams.get('pendingType') || 'all'; // 'all', 'BOTH_PENDING', 'INVOICE_PENDING', 'PAYMENT_PENDING', 'CLEARED'
    const searchQuery = (searchParams.get('search') || '').toLowerCase().trim();

    const jobs = await withDbRetry(async () => {
      return await prisma.jobMetadata.findMany({
        select: {
          id: true,
          clientName: true,
          branchName: true,
          personOfContact: true,
          workNature: true,
          manualEnteredBy: true,
          createdAt: true,
          paymentProgress: true,
          paymentStatus: true,
          ticket: {
            select: {
              id: true,
              serialNo: true,
              exactDate: true,
              time: true,
              subject: true,
              status: true,
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
              poNumber: true,
              lineItems: true,
              createdAt: true,
            }
          },
          payments: {
            select: {
              id: true,
              amount: true,
              taxDeducted: true,
              summaryNotes: true,
              createdAt: true,
            }
          },
          bankApproval: {
            select: {
              id: true,
              bankName: true,
              status: true,
              amount: true,
            }
          },
          workCompletion: {
            select: {
              id: true,
              status: true,
              amount: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    });

    const monthlySummaries = {};
    const globalSummary = {
      totalJobs: 0,
      totalQuoted: 0,
      totalInvoiced: 0,
      totalReceived: 0,
      totalTaxDeducted: 0,
      totalOutstanding: 0,
      invoicesPendingCount: 0,
      paymentsPendingCount: 0,
      bothPendingCount: 0,
      clearedCount: 0,
    };

    const distinctEmployees = new Set();
    const allItems = [];

    for (const j of jobs) {
      const rawDate = j.ticket?.exactDate || j.createdAt;
      const mKey = rawDate ? new Date(rawDate).toISOString().slice(0, 7) : '2026-01';

      if (!monthlySummaries[mKey]) {
        monthlySummaries[mKey] = {
          monthKey: mKey,
          monthName: MONTH_NAMES[mKey] || mKey,
          totalJobs: 0,
          totalQuoted: 0,
          totalInvoiced: 0,
          totalReceived: 0,
          totalTaxDeducted: 0,
          totalOutstanding: 0,
          invoicesPendingCount: 0,
          paymentsPendingCount: 0,
          bothPendingCount: 0,
          clearedCount: 0,
          employeeMap: {},
        };
      }

      const ms = monthlySummaries[mKey];

      const quotations = (j.quotationInvoices || []).filter(q => q.documentType === 'QUOTATION');
      const invoices = (j.quotationInvoices || []).filter(q => q.documentType === 'INVOICE');

      const totalQuotation = quotations.reduce((s, q) => s + parseLineItemsTotal(q.lineItems), 0);
      const totalInvoice = invoices.reduce((s, inv) => s + parseLineItemsTotal(inv.lineItems), 0);
      const netReceived = (j.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const taxDeducted = (j.payments || []).reduce((s, p) => s + (Number(p.taxDeducted) || 0), 0);
      const grossPayment = netReceived + taxDeducted;

      let outstanding = 0;
      if (totalInvoice > 0) {
        outstanding = Math.max(0, totalInvoice - grossPayment);
      } else if (totalQuotation > 0) {
        outstanding = Math.max(0, totalQuotation - grossPayment);
      }

      const hasApprovedInvoice = invoices.some(inv => inv.status === 'APPROVED' || inv.status === 'PAID');
      const isInvoicePending = invoices.length === 0 || !hasApprovedInvoice;
      const isPaymentPending = (j.paymentStatus !== 'PAID') || (outstanding > 0);

      let pendingCategory = 'CLEARED';
      let pendingLabel = 'Cleared';

      if (isInvoicePending && isPaymentPending) {
        pendingCategory = 'BOTH_PENDING';
        pendingLabel = 'Both Pending';
        ms.bothPendingCount++;
        globalSummary.bothPendingCount++;
      } else if (isInvoicePending) {
        pendingCategory = 'INVOICE_PENDING';
        pendingLabel = 'Invoice Pending';
      } else if (isPaymentPending) {
        pendingCategory = 'PAYMENT_PENDING';
        pendingLabel = 'Payment Pending';
      } else {
        ms.clearedCount++;
        globalSummary.clearedCount++;
      }

      if (isInvoicePending) {
        ms.invoicesPendingCount++;
        globalSummary.invoicesPendingCount++;
      }
      if (isPaymentPending) {
        ms.paymentsPendingCount++;
        globalSummary.paymentsPendingCount++;
      }

      ms.totalJobs++;
      ms.totalQuoted += totalQuotation;
      ms.totalInvoiced += totalInvoice;
      ms.totalReceived += netReceived;
      ms.totalTaxDeducted += taxDeducted;
      ms.totalOutstanding += outstanding;

      globalSummary.totalJobs++;
      globalSummary.totalQuoted += totalQuotation;
      globalSummary.totalInvoiced += totalInvoice;
      globalSummary.totalReceived += netReceived;
      globalSummary.totalTaxDeducted += taxDeducted;
      globalSummary.totalOutstanding += outstanding;

      const rawEmp = j.assignedEmployee?.employeeName || j.manualEnteredBy || j.createdBy?.employeeName || 'Unassigned';
      const empNormalized = normalizeEmployeeName(rawEmp);
      distinctEmployees.add(empNormalized);

      if (!ms.employeeMap[empNormalized]) {
        ms.employeeMap[empNormalized] = {
          name: empNormalized,
          jobsCount: 0,
          invoicesPending: 0,
          paymentsPending: 0,
          totalOutstanding: 0,
          sampleSerials: [],
        };
      }
      const empStat = ms.employeeMap[empNormalized];
      empStat.jobsCount++;
      if (isInvoicePending) empStat.invoicesPending++;
      if (isPaymentPending) empStat.paymentsPending++;
      empStat.totalOutstanding += outstanding;
      if (empStat.sampleSerials.length < 5 && j.ticket?.serialNo) {
        empStat.sampleSerials.push(j.ticket.serialNo);
      }

      let inquiryQuestion = '';
      if (isInvoicePending && isPaymentPending) {
        inquiryQuestion = `Why is invoice not issued and payment of ${outstanding > 0 ? 'Rs. ' + Math.round(outstanding).toLocaleString() : 'balance'} still uncollected for ${j.clientName}?`;
      } else if (isInvoicePending) {
        inquiryQuestion = `Work completed under ${j.workNature || 'General'}. Why has the tax invoice not been generated or approved yet?`;
      } else if (isPaymentPending) {
        inquiryQuestion = `Invoice issued for ${j.clientName}. Why is payment of Rs. ${Math.round(outstanding).toLocaleString()} overdue from client accounts?`;
      }

      const item = {
        id: j.id,
        serialNo: j.ticket?.serialNo || `JOB-${j.id}`,
        exactDate: rawDate ? new Date(rawDate).toISOString().slice(0, 10) : '—',
        monthKey: mKey,
        monthName: MONTH_NAMES[mKey] || mKey,
        clientName: j.clientName || 'Unspecified Client',
        branchName: j.branchName || 'Main',
        workNature: j.workNature || 'General',
        personOfContact: j.personOfContact || '—',
        assignedTo: empNormalized,
        quotationAmount: Math.round(totalQuotation),
        invoiceAmount: Math.round(totalInvoice),
        invoiceCount: invoices.length,
        invoiceStatuses: invoices.map(i => i.status).join(', ') || 'NOT ISSUED',
        invoicePoNumbers: invoices.map(i => i.poNumber).filter(Boolean).join(', ') || '—',
        netReceived: Math.round(netReceived),
        taxDeducted: Math.round(taxDeducted),
        grossReceived: Math.round(grossPayment),
        outstandingBalance: Math.round(outstanding),
        paymentStatus: j.paymentStatus || 'PENDING',
        paymentProgress: j.paymentProgress || 0,
        workCompletionStatus: j.workCompletion?.status || 'NOT_DONE',
        bankApprovalStatus: j.bankApproval?.status || 'NONE',
        isInvoicePending,
        isPaymentPending,
        pendingCategory,
        pendingLabel,
        inquiryQuestion,
        subject: j.ticket?.subject || 'No subject'
      };

      allItems.push(item);
    }

    // Apply filtering to items for response
    let filteredItems = allItems;

    if (monthFilter && monthFilter !== 'all') {
      filteredItems = filteredItems.filter(it => it.monthKey === monthFilter);
    }

    if (employeeFilter && employeeFilter !== 'all') {
      filteredItems = filteredItems.filter(it => it.assignedTo === employeeFilter);
    }

    if (pendingTypeFilter && pendingTypeFilter !== 'all') {
      filteredItems = filteredItems.filter(it => it.pendingCategory === pendingTypeFilter);
    }

    if (searchQuery) {
      filteredItems = filteredItems.filter(it => {
        return (
          it.serialNo.toLowerCase().includes(searchQuery) ||
          it.clientName.toLowerCase().includes(searchQuery) ||
          it.branchName.toLowerCase().includes(searchQuery) ||
          it.workNature.toLowerCase().includes(searchQuery) ||
          it.assignedTo.toLowerCase().includes(searchQuery) ||
          it.subject.toLowerCase().includes(searchQuery)
        );
      });
    }

    return NextResponse.json({
      success: true,
      monthsList: Object.keys(monthlySummaries).sort(),
      employeeList: Array.from(distinctEmployees).sort(),
      globalSummary,
      monthlySummaries,
      items: filteredItems,
      totalCount: filteredItems.length,
      downloadUrls: {
        pdf: '/reports/All_Months_Pending_Payments_and_Invoices_Checklist.pdf',
        xlsx: '/reports/All_Months_Pending_Payments_and_Invoices_Checklist.xlsx',
        csv: '/reports/All_Months_Pending_Payments_and_Invoices_Checklist.csv',
      }
    });
  } catch (error) {
    console.error('Pending checklist API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pending checklist', details: error.message },
      { status: 500 }
    );
  }
}
