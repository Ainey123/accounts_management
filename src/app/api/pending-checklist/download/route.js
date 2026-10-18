import { NextResponse } from 'next/server';
import { prisma, withDbRetry } from '@/lib/prisma';
import * as XLSX from 'xlsx';

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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'csv').toLowerCase();

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
    const domainOverview = { totalComplaints: 0, paymentReceived: 0, paymentPending: 0, poPending: 0, inprocess: 0, cancel: 0 };
    const batchCards = {};
    batchNames.forEach(b => {
      batchCards[b] = { totalComplaints: 0, paymentReceived: 0, paymentPending: 0, poPending: 0, inprocess: 0, cancel: 0 };
    });

    const monthlyCards = {};

    for (const j of jobs) {
      const rawEmp = j.ticket?.statusLastChangedBy || j.assignedEmployee?.employeeName || j.manualEnteredBy || j.createdBy?.employeeName;
      const bName = mapToBatchName(rawEmp);

      // Strictly audit the 4 operational batches (ignore unassigned/admin)
      if (!batchNames.includes(bName)) {
        continue;
      }

      const rawDate = j.ticket?.exactDate || j.createdAt;
      const mKey = rawDate ? new Date(rawDate).toISOString().slice(0, 7) : '2026-01';

      if (!monthlyCards[mKey]) {
        monthlyCards[mKey] = {
          monthKey: mKey,
          monthName: MONTH_NAMES[mKey] || mKey,
          totalComplaints: 0,
          paymentReceived: 0,
          paymentPending: 0,
          poPending: 0,
          inprocess: 0,
          cancel: 0,
        };
      }

      const mc = monthlyCards[mKey];
      const bc = batchCards[bName];

      domainOverview.totalComplaints++;
      bc.totalComplaints++;
      mc.totalComplaints++;

      const isCancel = j.ticket?.status === 'CANCELLED' || j.workCompletion?.status === 'CANCELLED';
      if (isCancel) {
        domainOverview.cancel++;
        bc.cancel++;
        mc.cancel++;
        continue;
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

      const isPaymentCleared = (j.paymentStatus === 'PAID' || j.paymentStatus === 'CLEARED' || (j.paymentProgress || 0) >= 100) || (baseAmount > 0 && balanceDue <= 0 && grossPayment > 0);
      const hasPO = invoices.some(i => i.poNumber && i.poNumber.trim()) || quotations.some(q => q.poNumber && q.poNumber.trim());

      if (isPaymentCleared) {
        domainOverview.paymentReceived++;
        bc.paymentReceived++;
        mc.paymentReceived++;
      } else if (invoices.length > 0 || (j.payments || []).length > 0 || j.paymentStatus === 'PARTIAL') {
        domainOverview.paymentPending++;
        bc.paymentPending++;
        mc.paymentPending++;
      } else if (!hasPO && quotations.length > 0) {
        domainOverview.poPending++;
        bc.poPending++;
        mc.poPending++;
      } else {
        domainOverview.inprocess++;
        bc.inprocess++;
        mc.inprocess++;
      }
    }

    const sortedMonthKeys = Object.keys(monthlyCards).sort();

    if (format === 'csv') {
      const csvLines = ['Card Title,Batch / Tenure,Metric Name,Value'];
      const addCsvCard = (title, batch, obj) => {
        csvLines.push(`"${title}","${batch}","Total no of Complaints",${obj.totalComplaints}`);
        csvLines.push(`"${title}","${batch}","Total no of Payment Received Cases",${obj.paymentReceived}`);
        csvLines.push(`"${title}","${batch}","Total no of Payment Pending Cases",${obj.paymentPending}`);
        csvLines.push(`"${title}","${batch}","Total no of PO Pending Cases",${obj.poPending}`);
        csvLines.push(`"${title}","${batch}","Total no of Inprocess Cases",${obj.inprocess}`);
        csvLines.push(`"${title}","${batch}","Total no of Cancel Cases",${obj.cancel}`);
      };

      addCsvCard('Domain Overview', 'All Batches', domainOverview);
      batchNames.forEach(b => addCsvCard('Domain Overview', b, batchCards[b]));
      sortedMonthKeys.forEach(mKey => addCsvCard('Domain Overview', monthlyCards[mKey].monthName, monthlyCards[mKey]));

      return new Response(csvLines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="Cards_Summary_Pending_Audit.csv"',
        }
      });
    }

    if (format === 'xlsx' || format === 'excel') {
      const wb = XLSX.utils.book_new();
      const excelRows = [
        ['Domain Overview'],
        ['Overall All Batches'],
        ['Total no of Complaints', domainOverview.totalComplaints],
        ['Total no of Payment Received Cases', domainOverview.paymentReceived],
        ['Total no of Payment Pending Cases', domainOverview.paymentPending],
        ['Total no of PO Pending Cases', domainOverview.poPending],
        ['Total no of Inprocess Cases', domainOverview.inprocess],
        ['Total no of Cancel Cases', domainOverview.cancel],
        [],
      ];

      batchNames.forEach(b => {
        const bc = batchCards[b];
        excelRows.push(
          ['Domain Overview'],
          [b],
          ['Total no of Complaints', bc.totalComplaints],
          ['Total no of Payment Received Cases', bc.paymentReceived],
          ['Total no of Payment Pending Cases', bc.paymentPending],
          ['Total no of PO Pending Cases', bc.poPending],
          ['Total no of Inprocess Cases', bc.inprocess],
          ['Total no of Cancel Cases', bc.cancel],
          []
        );
      });

      const wsDomain = XLSX.utils.aoa_to_sheet(excelRows);
      XLSX.utils.book_append_sheet(wb, wsDomain, 'Domain_Overview_Cards');

      const tenureExcelRows = [['Domain Overview — Tenure Wise Cards'], []];
      sortedMonthKeys.forEach(mKey => {
        const mc = monthlyCards[mKey];
        tenureExcelRows.push(
          ['Domain Overview'],
          [`Tenure: ${mc.monthName}`],
          ['Total no of Complaints', mc.totalComplaints],
          ['Total no of Payment Received Cases', mc.paymentReceived],
          ['Total no of Payment Pending Cases', mc.paymentPending],
          ['Total no of PO Pending Cases', mc.poPending],
          ['Total no of Inprocess Cases', mc.inprocess],
          ['Total no of Cancel Cases', mc.cancel],
          []
        );
      });

      const wsTenure = XLSX.utils.aoa_to_sheet(tenureExcelRows);
      XLSX.utils.book_append_sheet(wb, wsTenure, 'Tenure_Cards');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="Cards_Summary_Pending_Audit.xlsx"',
        }
      });
    }

    return NextResponse.json({ error: 'Unsupported format. Use ?format=csv or ?format=xlsx' }, { status: 400 });
  } catch (error) {
    console.error('Download API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
