const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const XLSX = require('xlsx');
const { PrismaClient } = require(path.join(__dirname, '../src/generated/client/index.js'));

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.cheqzrvucqlrdtlvfirk:anie%401234%231234@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
    }
  }
});

function parseLineItemsTotal(lineItems) {
  if (!lineItems) return 0;
  try {
    const items = typeof lineItems === 'string' ? JSON.parse(lineItems) : lineItems;
    if (Array.isArray(items)) {
      return items.reduce((sum, it) => sum + (Number(it.amount) || ((Number(it.qty) || 0) * (Number(it.rate) || 0)) || 0), 0);
    }
  } catch (e) {}
  return 0;
}

function escapeHtml(text) {
  if (!text) return '—';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeCsv(value) {
  if (value == null) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatMoney(num) {
  if (!num && num !== 0) return '—';
  return 'Rs. ' + Math.round(num).toLocaleString('en-US');
}

function formatDate(dateVal) {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  return d.toISOString().slice(0, 10);
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

async function main() {
  console.log('Fetching all jobs and related records from database...');
  console.time('DB_FETCH');

  const jobs = await prisma.jobMetadata.findMany({
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
    orderBy: { createdAt: 'asc' }
  });

  console.timeEnd('DB_FETCH');
  console.log(`Fetched ${jobs.length} jobs. Processing monthly financial aggregations...`);

  // Group by month
  const monthlyGroups = {};
  const globalSummary = {
    totalJobs: jobs.length,
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

  for (const j of jobs) {
    const rawDate = j.ticket?.exactDate || j.createdAt;
    const mKey = rawDate ? new Date(rawDate).toISOString().slice(0, 7) : '2026-01';
    if (!monthlyGroups[mKey]) {
      monthlyGroups[mKey] = {
        key: mKey,
        name: MONTH_NAMES[mKey] || mKey,
        jobs: [],
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

    const mg = monthlyGroups[mKey];

    const quotations = (j.quotationInvoices || []).filter(q => q.documentType === 'QUOTATION');
    const invoices = (j.quotationInvoices || []).filter(q => q.documentType === 'INVOICE');

    const totalQuotation = quotations.reduce((s, q) => s + parseLineItemsTotal(q.lineItems), 0);
    const totalInvoice = invoices.reduce((s, inv) => s + parseLineItemsTotal(inv.lineItems), 0);
    const netReceived = (j.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const taxDeducted = (j.payments || []).reduce((s, p) => s + (Number(p.taxDeducted) || 0), 0);
    const grossPayment = netReceived + taxDeducted;

    // Determine outstanding balance
    let outstanding = 0;
    if (totalInvoice > 0) {
      outstanding = Math.max(0, totalInvoice - grossPayment);
    } else if (totalQuotation > 0) {
      outstanding = Math.max(0, totalQuotation - grossPayment);
    }

    // Determine pending flags
    const hasApprovedInvoice = invoices.some(inv => inv.status === 'APPROVED' || inv.status === 'PAID');
    const isInvoicePending = invoices.length === 0 || !hasApprovedInvoice;
    const isPaymentPending = (j.paymentStatus !== 'PAID') || (outstanding > 0);

    let pendingCategory = 'CLEARED';
    let pendingBadgeClass = 'badge-green';
    let pendingLabel = 'Cleared';

    if (isInvoicePending && isPaymentPending) {
      pendingCategory = 'BOTH_PENDING';
      pendingBadgeClass = 'badge-red';
      pendingLabel = 'Both Pending';
      mg.bothPendingCount++;
      globalSummary.bothPendingCount++;
    } else if (isInvoicePending) {
      pendingCategory = 'INVOICE_PENDING';
      pendingBadgeClass = 'badge-amber';
      pendingLabel = 'Invoice Pending';
    } else if (isPaymentPending) {
      pendingCategory = 'PAYMENT_PENDING';
      pendingBadgeClass = 'badge-blue';
      pendingLabel = 'Payment Pending';
    } else {
      mg.clearedCount++;
      globalSummary.clearedCount++;
    }

    if (isInvoicePending) {
      mg.invoicesPendingCount++;
      globalSummary.invoicesPendingCount++;
    }
    if (isPaymentPending) {
      mg.paymentsPendingCount++;
      globalSummary.paymentsPendingCount++;
    }

    mg.totalQuoted += totalQuotation;
    mg.totalInvoiced += totalInvoice;
    mg.totalReceived += netReceived;
    mg.totalTaxDeducted += taxDeducted;
    mg.totalOutstanding += outstanding;

    globalSummary.totalQuoted += totalQuotation;
    globalSummary.totalInvoiced += totalInvoice;
    globalSummary.totalReceived += netReceived;
    globalSummary.totalTaxDeducted += taxDeducted;
    globalSummary.totalOutstanding += outstanding;

    const rawEmp = j.assignedEmployee?.employeeName || j.manualEnteredBy || j.createdBy?.employeeName || 'Unassigned';
    const empNormalized = normalizeEmployeeName(rawEmp);

    if (!mg.employeeMap[empNormalized]) {
      mg.employeeMap[empNormalized] = {
        name: empNormalized,
        jobsCount: 0,
        invoicesPending: 0,
        paymentsPending: 0,
        totalOutstanding: 0,
        sampleSerials: []
      };
    }
    const empStat = mg.employeeMap[empNormalized];
    empStat.jobsCount++;
    if (isInvoicePending) empStat.invoicesPending++;
    if (isPaymentPending) empStat.paymentsPending++;
    empStat.totalOutstanding += outstanding;
    if (empStat.sampleSerials.length < 5 && j.ticket?.serialNo) {
      empStat.sampleSerials.push(j.ticket.serialNo);
    }

    const processedJob = {
      id: j.id,
      serialNo: j.ticket?.serialNo || `JOB-${j.id}`,
      exactDate: rawDate ? formatDate(rawDate) : '—',
      clientName: j.clientName || 'Unspecified Client',
      branchName: j.branchName || 'Main',
      workNature: j.workNature || 'General',
      personOfContact: j.personOfContact || '—',
      assignedTo: empNormalized,
      quotationAmount: totalQuotation,
      invoiceAmount: totalInvoice,
      invoiceCount: invoices.length,
      invoiceStatuses: invoices.map(i => i.status).join(', ') || 'NOT ISSUED',
      invoicePoNumbers: invoices.map(i => i.poNumber).filter(Boolean).join(', ') || '—',
      netReceived,
      taxDeducted,
      grossReceived: grossPayment,
      outstandingBalance: outstanding,
      paymentStatus: j.paymentStatus || 'PENDING',
      paymentProgress: j.paymentProgress || 0,
      workCompletionStatus: j.workCompletion?.status || 'NOT_DONE',
      bankApprovalStatus: j.bankApproval?.status || 'NONE',
      isInvoicePending,
      isPaymentPending,
      pendingCategory,
      pendingBadgeClass,
      pendingLabel,
      subject: j.ticket?.subject || 'No subject'
    };

    mg.jobs.push(processedJob);
  }

  const sortedMonthKeys = Object.keys(monthlyGroups).sort();
  console.log(`Processed ${sortedMonthKeys.length} months.`);

  // -------------------------------------------------------------
  // 1. GENERATE EXCEL WORKBOOK (.XLSX)
  // -------------------------------------------------------------
  console.log('Building Multi-Sheet Excel Workbook...');
  const workbook = XLSX.utils.book_new();

  // 1A. Executive Summary Sheet
  const summarySheetData = [
    ['NEXUS OPERATIONS — MONTHLY AUDIT: PENDING INVOICES & PAYMENTS CHECKLIST'],
    ['Generated On:', new Date().toLocaleString()],
    ['Total Complaints / Jobs Analyzed:', globalSummary.totalJobs],
    ['Total Quoted Exposure:', globalSummary.totalQuoted],
    ['Total Invoiced Amount:', globalSummary.totalInvoiced],
    ['Total Payment Collected (Cash):', globalSummary.totalReceived],
    ['Total Withholding Tax Deducted:', globalSummary.totalTaxDeducted],
    ['Total Recovered (Gross):', globalSummary.totalReceived + globalSummary.totalTaxDeducted],
    ['Total Outstanding Balance:', globalSummary.totalOutstanding],
    ['Total Jobs with Pending Invoices:', globalSummary.invoicesPendingCount],
    ['Total Jobs with Pending Payments:', globalSummary.paymentsPendingCount],
    [],
    ['MONTH-BY-MONTH RECOVERY BREAKDOWN & EXPOSURE MATRIX'],
    [
      'Month',
      'Total Complaints',
      'Quoted Amount (Rs)',
      'Invoiced Amount (Rs)',
      'Cash Received (Rs)',
      'Tax Deducted (Rs)',
      'Total Recovered (Rs)',
      'Outstanding Balance (Rs)',
      'Invoices Pending (Count)',
      'Payments Pending (Count)',
      'Both Pending (Count)',
      'Recovery Rate %'
    ]
  ];

  sortedMonthKeys.forEach(mKey => {
    const mg = monthlyGroups[mKey];
    const recRate = mg.totalInvoiced > 0 ? ((mg.totalReceived + mg.totalTaxDeducted) / mg.totalInvoiced * 100).toFixed(1) : '0.0';
    summarySheetData.push([
      mg.name,
      mg.jobs.length,
      mg.totalQuoted,
      mg.totalInvoiced,
      mg.totalReceived,
      mg.totalTaxDeducted,
      mg.totalReceived + mg.totalTaxDeducted,
      mg.totalOutstanding,
      mg.invoicesPendingCount,
      mg.paymentsPendingCount,
      mg.bothPendingCount,
      `${recRate}%`
    ]);
  });

  const wsSummary = XLSX.utils.aoa_to_sheet(summarySheetData);
  XLSX.utils.book_append_sheet(workbook, wsSummary, 'Executive_Summary');

  // 1B. All Months Combined Detailed Checklist Sheet
  const allRowsHeader = [
    'Month',
    'Serial No',
    'Date',
    'Client Name',
    'Branch Name',
    'Work Nature',
    'Assigned Officer / Team',
    'Pending Category',
    'Checklist Status [x]',
    'Quotation Amount (Rs)',
    'Invoice Amount (Rs)',
    'Invoice Count',
    'Invoice Status',
    'PO Number',
    'Cash Received (Rs)',
    'Tax Deducted (Rs)',
    'Total Recovered (Rs)',
    'Outstanding Balance (Rs)',
    'Payment Status',
    'Work Completion',
    'Bank Approval',
    'Audit Inquiry Question for Month-End Review',
    'Officer / Client Reason for Pending',
    'Committed Resolution Date',
    'Supervisor Sign-off'
  ];

  const allRowsData = [allRowsHeader];

  sortedMonthKeys.forEach(mKey => {
    const mg = monthlyGroups[mKey];
    mg.jobs.forEach(job => {
      let inquiryQuestion = '';
      if (job.isInvoicePending && job.isPaymentPending) {
        inquiryQuestion = `Why is invoice not issued and payment of ${job.outstandingBalance > 0 ? formatMoney(job.outstandingBalance) : 'pending balance'} still uncollected for ${job.clientName} (${job.branchName})?`;
      } else if (job.isInvoicePending) {
        inquiryQuestion = `Work completed under ${job.workNature} for ${job.clientName}. Why has the tax invoice not been generated or approved yet?`;
      } else if (job.isPaymentPending) {
        inquiryQuestion = `Invoice issued for ${job.clientName} (${job.branchName}). Why is payment of ${formatMoney(job.outstandingBalance)} overdue from client accounts?`;
      }

      allRowsData.push([
        mg.name,
        job.serialNo,
        job.exactDate,
        job.clientName,
        job.branchName,
        job.workNature,
        job.assignedTo,
        job.pendingLabel,
        '[ ]', // Checklist checkbox
        job.quotationAmount,
        job.invoiceAmount,
        job.invoiceCount,
        job.invoiceStatuses,
        job.invoicePoNumbers,
        job.netReceived,
        job.taxDeducted,
        job.grossReceived,
        job.outstandingBalance,
        job.paymentStatus,
        job.workCompletionStatus,
        job.bankApprovalStatus,
        inquiryQuestion,
        '', // Space for employee reason
        '', // Space for committed date
        ''  // Space for supervisor sign-off
      ]);
    });
  });

  const wsAll = XLSX.utils.aoa_to_sheet(allRowsData);
  XLSX.utils.book_append_sheet(workbook, wsAll, 'All_Pendings_Master');

  // 1C. Monthly Sheets (For individual monthly focus)
  sortedMonthKeys.forEach(mKey => {
    const mg = monthlyGroups[mKey];
    const sheetName = mKey.replace('-', '_'); // e.g., 2026_01
    const monthlySheetData = [
      [`NEXUS OPERATIONS — ${mg.name.toUpperCase()} PENDING CHECKLIST`],
      [`Month: ${mg.name}`, `Total Jobs: ${mg.jobs.length}`, `Outstanding Balance: Rs. ${mg.totalOutstanding.toLocaleString()}`],
      [`Pending Invoices: ${mg.invoicesPendingCount}`, `Pending Payments: ${mg.paymentsPendingCount}`, `Both Pending: ${mg.bothPendingCount}`],
      [],
      [
        'Serial No',
        'Date',
        'Client Name',
        'Branch Name',
        'Work Nature',
        'Assigned Officer',
        'Checklist [x]',
        'Pending Issue',
        'Quotation (Rs)',
        'Invoice (Rs)',
        'Invoice Status',
        'Recovered (Rs)',
        'Outstanding Balance (Rs)',
        'Payment Status',
        'Audit Inquiry Prompt',
        'Reason for Pending (Officer/Client)',
        'Resolution Date'
      ]
    ];

    mg.jobs.forEach(job => {
      let inquiry = job.isInvoicePending && job.isPaymentPending
        ? `Invoice & Payment unrecovered (${formatMoney(job.outstandingBalance)})`
        : job.isInvoicePending
        ? `Invoice missing/unapproved for ${job.clientName}`
        : `Payment overdue (${formatMoney(job.outstandingBalance)})`;

      monthlySheetData.push([
        job.serialNo,
        job.exactDate,
        job.clientName,
        job.branchName,
        job.workNature,
        job.assignedTo,
        '[ ]',
        job.pendingLabel,
        job.quotationAmount,
        job.invoiceAmount,
        job.invoiceStatuses,
        job.grossReceived,
        job.outstandingBalance,
        job.paymentStatus,
        inquiry,
        '',
        ''
      ]);
    });

    // Add End of Month Inquiry Questionnaire Rows to the Excel Sheet
    monthlySheetData.push([]);
    monthlySheetData.push([`=== END-OF-MONTH AUDIT & INQUIRY QUESTIONNAIRE: ${mg.name.toUpperCase()} ===`]);
    monthlySheetData.push(['Assigned Officer', 'Pending Invoices', 'Pending Payments', 'Outstanding Balance (Rs)', 'Mandatory Inquiry: Why are these items pending?', 'Officer Justification & Action Plan', 'Committed Clearance Date', 'Admin Verification']);
    
    Object.values(mg.employeeMap).forEach(emp => {
      if (emp.invoicesPending > 0 || emp.paymentsPending > 0) {
        monthlySheetData.push([
          emp.name,
          emp.invoicesPending,
          emp.paymentsPending,
          emp.totalOutstanding,
          `Inquire ${emp.name} regarding ${emp.invoicesPending} pending invoices and ${emp.paymentsPending} pending payments (Sample tickets: ${emp.sampleSerials.join(', ')})`,
          '', // Empty response field
          '',
          '[ ] Verified'
        ]);
      }
    });

    const wsMonth = XLSX.utils.aoa_to_sheet(monthlySheetData);
    XLSX.utils.book_append_sheet(workbook, wsMonth, sheetName);
  });

  // Write Excel file
  const xlsxPath = path.join(__dirname, '../All_Months_Pending_Payments_and_Invoices_Checklist.xlsx');
  XLSX.writeFile(workbook, xlsxPath);
  console.log(`✓ Excel file generated successfully: ${xlsxPath}`);

  // -------------------------------------------------------------
  // 2. GENERATE UNIVERSAL CSV FILE (.CSV)
  // -------------------------------------------------------------
  console.log('Building Universal CSV Checklist...');
  const csvLines = [allRowsHeader.map(escapeCsv).join(',')];
  for (let i = 1; i < allRowsData.length; i++) {
    csvLines.push(allRowsData[i].map(escapeCsv).join(','));
  }
  const csvPath = path.join(__dirname, '../All_Months_Pending_Payments_and_Invoices_Checklist.csv');
  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8');
  console.log(`✓ Universal CSV generated successfully: ${csvPath}`);

  // -------------------------------------------------------------
  // 3. GENERATE COMPREHENSIVE AUDIT PDF (.PDF & .HTML)
  // -------------------------------------------------------------
  console.log('Building High-Res HTML and PDF Document...');

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>All Months Pending Payments & Invoices Audit Checklist</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
    
    @page {
      size: A4 landscape;
      margin: 10mm 10mm 12mm 10mm;
      @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        font-family: 'Inter', sans-serif;
        font-size: 7.5pt;
        color: #94a3b8;
      }
      @bottom-left {
        content: "NEXUS OPERATIONS — All Months Pending Payments & Invoices Audit Checklist";
        font-family: 'Inter', sans-serif;
        font-size: 7.5pt;
        color: #94a3b8;
      }
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 7.5pt;
      line-height: 1.35;
      color: #1e293b;
      background: #ffffff;
      padding: 6px;
    }

    .report-header {
      border-bottom: 2.5px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .report-title {
      font-size: 18pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
    }

    .report-subtitle {
      font-size: 8.5pt;
      color: #64748b;
      margin-top: 4px;
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 10px;
      margin-bottom: 20px;
      page-break-inside: avoid;
    }

    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      border-top: 3.5px solid #4f46e5;
    }

    .kpi-label {
      font-size: 7pt;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .kpi-value {
      font-size: 15pt;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.1;
      font-family: 'JetBrains Mono', monospace;
    }

    .kpi-sub {
      font-size: 7pt;
      color: #94a3b8;
      margin-top: 3px;
    }

    .month-section-banner {
      background: #0f172a;
      color: #ffffff;
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 9.5pt;
      font-weight: 700;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 24px;
      margin-bottom: 10px;
      page-break-after: avoid;
    }

    .month-stats-banner {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 14px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8pt;
      page-break-inside: avoid;
    }

    .stat-pill {
      font-weight: 600;
      color: #334155;
    }

    .stat-pill strong {
      color: #0f172a;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      page-break-inside: auto;
    }

    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }

    thead {
      display: table-header-group;
    }

    th {
      background: #1e293b;
      color: #ffffff;
      font-weight: 600;
      font-size: 6.8pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 6px 7px;
      text-align: left;
      border: 1px solid #334155;
    }

    td {
      padding: 5px 6px;
      border: 1px solid #e2e8f0;
      font-size: 7pt;
      vertical-align: middle;
    }

    tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    .mono {
      font-family: 'JetBrains Mono', monospace;
      font-size: 6.8pt;
    }

    .text-right { text-align: right; }
    .text-center { text-align: center; }

    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 6.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      white-space: nowrap;
    }

    .badge-red {
      background: #fee2e2;
      color: #991b1b;
      border: 1px solid #fecaca;
    }

    .badge-amber {
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fde68a;
    }

    .badge-blue {
      background: #e0e7ff;
      color: #3730a3;
      border: 1px solid #c7d2fe;
    }

    .badge-green {
      background: #dcfce7;
      color: #166534;
      border: 1px solid #bbf7d0;
    }

    .chk-box {
      display: inline-block;
      width: 13px;
      height: 13px;
      border: 1.5px solid #64748b;
      border-radius: 3px;
      vertical-align: middle;
      background: #ffffff;
    }

    /* End-of-month audit box styling */
    .audit-inquiry-box {
      background: #fffbeb;
      border: 2px solid #f59e0b;
      border-radius: 8px;
      padding: 14px 16px;
      margin-top: 14px;
      margin-bottom: 28px;
      page-break-inside: avoid;
    }

    .audit-inquiry-title {
      font-size: 10pt;
      font-weight: 800;
      color: #b45309;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .audit-subtitle {
      font-size: 7.8pt;
      color: #78350f;
      margin-bottom: 12px;
      line-height: 1.4;
    }

    .officer-inquiry-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      background: #ffffff;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid #fde68a;
    }

    .officer-inquiry-table th {
      background: #78350f;
      color: #ffffff;
      font-size: 6.8pt;
      padding: 5px 8px;
      border: 1px solid #92400e;
    }

    .officer-inquiry-table td {
      padding: 6px 8px;
      border: 1px solid #fef3c7;
      font-size: 7.2pt;
      background: #ffffff;
    }

    .write-in-line {
      display: block;
      border-bottom: 1px dashed #cbd5e1;
      height: 14px;
      margin-top: 3px;
      width: 100%;
    }

    .action-checklist-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-top: 10px;
      background: #ffffff;
      padding: 10px 12px;
      border-radius: 6px;
      border: 1px solid #fde68a;
    }

    .action-chk-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 7.2pt;
      color: #451a03;
      font-weight: 500;
    }

    .page-break {
      page-break-before: always;
    }
  </style>
</head>
<body>

  <!-- REPORT COVER / EXECUTIVE DASHBOARD -->
  <div class="report-header">
    <div>
      <div style="font-size: 8.5pt; color: #4f46e5; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px;">
        NEXUS OPERATIONS &bull; FINANCIAL AUDIT & RECOVERY DIVISION
      </div>
      <div class="report-title">
        Monthly Pending Payments &amp; Invoices Audit Checklist
      </div>
      <div class="report-subtitle">
        Scope: <strong>All Months (January 2026 – October 2026)</strong> &bull; Complete Complaints &amp; Job Orders Registry &bull; Actionable Inquiry Protocols
      </div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 13pt; font-weight: 800; color: #dc2626;">Rs. ${Math.round(globalSummary.totalOutstanding).toLocaleString()} Due</div>
      <div style="font-size: 7.5pt; color: #64748b;">Generated on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
    </div>
  </div>

  <!-- EXECUTIVE KPI METRICS -->
  <div class="kpi-grid">
    <div class="kpi-card" style="border-top-color: #0f172a;">
      <div class="kpi-label">Total Complaints / Jobs</div>
      <div class="kpi-value">${globalSummary.totalJobs}</div>
      <div class="kpi-sub">Analyzed across 10 months</div>
    </div>
    <div class="kpi-card" style="border-top-color: #f59e0b;">
      <div class="kpi-label">Invoices Pending</div>
      <div class="kpi-value" style="color: #b45309;">${globalSummary.invoicesPendingCount}</div>
      <div class="kpi-sub">Missing or unapproved invoices</div>
    </div>
    <div class="kpi-card" style="border-top-color: #ef4444;">
      <div class="kpi-label">Payments Pending</div>
      <div class="kpi-value" style="color: #dc2626;">${globalSummary.paymentsPendingCount}</div>
      <div class="kpi-sub">Uncollected customer balances</div>
    </div>
    <div class="kpi-card" style="border-top-color: #6366f1;">
      <div class="kpi-label">Total Invoiced (PKR)</div>
      <div class="kpi-value" style="font-size: 13pt;">Rs. ${(globalSummary.totalInvoiced / 1000000).toFixed(2)}M</div>
      <div class="kpi-sub">Total billed to clients</div>
    </div>
    <div class="kpi-card" style="border-top-color: #10b981;">
      <div class="kpi-label">Total Recovered (PKR)</div>
      <div class="kpi-value" style="color: #047857; font-size: 13pt;">Rs. ${((globalSummary.totalReceived + globalSummary.totalTaxDeducted) / 1000000).toFixed(2)}M</div>
      <div class="kpi-sub">Cash received + Tax credit</div>
    </div>
    <div class="kpi-card" style="border-top-color: #dc2626;">
      <div class="kpi-label">Total Outstanding Due</div>
      <div class="kpi-value" style="color: #b91c1c; font-size: 13pt;">Rs. ${(globalSummary.totalOutstanding / 1000000).toFixed(2)}M</div>
      <div class="kpi-sub">Pending collection &amp; inquiry</div>
    </div>
  </div>

  <!-- EXECUTIVE MULTI-MONTH TABLE -->
  <div style="margin-bottom: 20px;">
    <div style="font-size: 9pt; font-weight: 700; color: #0f172a; margin-bottom: 6px;">Executive Monthly Performance &amp; Pending Balance Matrix</div>
    <table>
      <thead>
        <tr>
          <th>Month</th>
          <th class="text-center">Total Jobs</th>
          <th class="text-right">Quoted (PKR)</th>
          <th class="text-right">Invoiced (PKR)</th>
          <th class="text-right">Received (PKR)</th>
          <th class="text-right">Tax (PKR)</th>
          <th class="text-right">Net Outstanding (PKR)</th>
          <th class="text-center">Invoices Pending</th>
          <th class="text-center">Payments Pending</th>
          <th class="text-center">Recovery %</th>
        </tr>
      </thead>
      <tbody>
`;

  sortedMonthKeys.forEach(mKey => {
    const mg = monthlyGroups[mKey];
    const recRate = mg.totalInvoiced > 0 ? ((mg.totalReceived + mg.totalTaxDeducted) / mg.totalInvoiced * 100).toFixed(1) : '0.0';
    html += `
        <tr>
          <td style="font-weight: 700;">${mg.name}</td>
          <td class="text-center mono">${mg.jobs.length}</td>
          <td class="text-right mono">${formatMoney(mg.totalQuoted)}</td>
          <td class="text-right mono">${formatMoney(mg.totalInvoiced)}</td>
          <td class="text-right mono" style="color: #15803d;">${formatMoney(mg.totalReceived)}</td>
          <td class="text-right mono">${formatMoney(mg.totalTaxDeducted)}</td>
          <td class="text-right mono" style="font-weight: 700; color: ${mg.totalOutstanding > 0 ? '#b91c1c' : '#15803d'};">${formatMoney(mg.totalOutstanding)}</td>
          <td class="text-center"><span class="badge badge-amber">${mg.invoicesPendingCount}</span></td>
          <td class="text-center"><span class="badge badge-red">${mg.paymentsPendingCount}</span></td>
          <td class="text-center mono" style="font-weight: 700;">${recRate}%</td>
        </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  </div>
`;

  // -------------------------------------------------------------
  // MONTH-BY-MONTH DETAILED CHECKLIST & END-OF-MONTH INQUIRIES
  // -------------------------------------------------------------
  sortedMonthKeys.forEach((mKey, idx) => {
    const mg = monthlyGroups[mKey];
    html += `
  <div class="page-break"></div>

  <!-- MONTH SECTION HEADER -->
  <div class="month-section-banner">
    <div>
      <span style="font-size: 11pt; text-transform: uppercase; letter-spacing: 0.5px;">${mg.name} &mdash; PENDING PAYMENTS &amp; INVOICES CHECKLIST</span>
    </div>
    <div style="font-size: 8pt; font-weight: 500;">
      ${mg.jobs.length} Records &bull; Month Code: <strong>${mKey}</strong>
    </div>
  </div>

  <div class="month-stats-banner">
    <div class="stat-pill">Total Complaints: <strong>${mg.jobs.length}</strong></div>
    <div class="stat-pill">Invoices Pending: <strong style="color: #b45309;">${mg.invoicesPendingCount}</strong></div>
    <div class="stat-pill">Payments Pending: <strong style="color: #dc2626;">${mg.paymentsPendingCount}</strong></div>
    <div class="stat-pill">Total Invoiced: <strong>${formatMoney(mg.totalInvoiced)}</strong></div>
    <div class="stat-pill">Total Collected: <strong style="color: #166534;">${formatMoney(mg.totalReceived + mg.totalTaxDeducted)}</strong></div>
    <div class="stat-pill">Unpaid Balance: <strong style="color: #b91c1c; font-size: 9pt;">${formatMoney(mg.totalOutstanding)}</strong></div>
  </div>

  <!-- DETAILED MONTHLY TABLE -->
  <table>
    <thead>
      <tr>
        <th style="width: 26px; text-align: center;">[x]</th>
        <th style="width: 65px;">Serial #</th>
        <th style="width: 60px;">Date</th>
        <th style="width: 140px;">Client &amp; Branch</th>
        <th style="width: 75px;">Nature</th>
        <th style="width: 110px;">Assigned Officer</th>
        <th style="width: 75px; text-align: right;">Quotation</th>
        <th style="width: 75px; text-align: right;">Invoice</th>
        <th style="width: 75px; text-align: right;">Received</th>
        <th style="width: 80px; text-align: right;">Outstanding</th>
        <th style="width: 90px; text-align: center;">Pending Issue</th>
      </tr>
    </thead>
    <tbody>
`;

    mg.jobs.forEach(job => {
      html += `
      <tr>
        <td class="text-center"><span class="chk-box"></span></td>
        <td class="mono" style="font-weight: 700; color: #0f172a;">${escapeHtml(job.serialNo)}</td>
        <td class="mono">${escapeHtml(job.exactDate)}</td>
        <td>
          <div style="font-weight: 700; color: #0f172a;">${escapeHtml(job.clientName)}</div>
          <div style="color: #64748b; font-size: 6.5pt;">${escapeHtml(job.branchName)}</div>
        </td>
        <td><span style="font-size: 6.5pt; font-weight: 600; color: #475569;">${escapeHtml(job.workNature)}</span></td>
        <td style="font-weight: 600; color: #334155;">${escapeHtml(job.assignedTo)}</td>
        <td class="text-right mono">${formatMoney(job.quotationAmount)}</td>
        <td class="text-right mono">
          <div>${formatMoney(job.invoiceAmount)}</div>
          <div style="font-size: 6pt; color: #64748b;">${job.invoiceStatuses}</div>
        </td>
        <td class="text-right mono" style="color: #166534;">${formatMoney(job.grossReceived)}</td>
        <td class="text-right mono" style="font-weight: 700; color: ${job.outstandingBalance > 0 ? '#b91c1c' : '#166534'};">
          ${formatMoney(job.outstandingBalance)}
        </td>
        <td class="text-center">
          <span class="badge ${job.pendingBadgeClass}">${job.pendingLabel}</span>
        </td>
      </tr>
`;
    });

    html += `
    </tbody>
  </table>

  <!-- END-OF-MONTH AUDIT & INQUIRY SECTION ("Ask Them Why These Are Pendings") -->
  <div class="audit-inquiry-box">
    <div class="audit-inquiry-title">
      <span>📋 ${mg.name.toUpperCase()} END-OF-MONTH AUDIT: "WHY ARE THESE PENDINGS?" INQUIRY PROTOCOL</span>
    </div>
    <div class="audit-subtitle">
      <strong>Instructions for Auditor / Financial Controller:</strong> This mandatory section addresses all unresolved complaints for <strong>${mg.name}</strong>. Cross-examine the assigned team officers on why invoices remain unapproved or payments remain unrecovered, document their exact verbal/written justifications, and establish firm resolution commitments.
    </div>

    <!-- OFFICER INQUIRY TABLE -->
    <table class="officer-inquiry-table">
      <thead>
        <tr>
          <th style="width: 125px;">Assigned Officer / Team</th>
          <th style="width: 80px; text-align: center;">Invoices Pending</th>
          <th style="width: 80px; text-align: center;">Payments Pending</th>
          <th style="width: 100px; text-align: right;">Total Balance Due</th>
          <th style="width: 230px;">Mandatory Inquiry Questions</th>
          <th>Officer Justification &amp; Promised Action Plan</th>
          <th style="width: 90px; text-align: center;">Target Date</th>
          <th style="width: 60px; text-align: center;">Sign-Off</th>
        </tr>
      </thead>
      <tbody>
`;

    Object.values(mg.employeeMap).forEach(emp => {
      if (emp.invoicesPending > 0 || emp.paymentsPending > 0) {
        html += `
        <tr>
          <td style="font-weight: 700; color: #0f172a;">
            ${escapeHtml(emp.name)}
            <div style="font-size: 6.2pt; color: #64748b; font-weight: normal;">Tickets: ${emp.sampleSerials.join(', ')}</div>
          </td>
          <td class="text-center mono" style="font-weight: 700; color: #b45309;">${emp.invoicesPending}</td>
          <td class="text-center mono" style="font-weight: 700; color: #dc2626;">${emp.paymentsPending}</td>
          <td class="text-right mono" style="font-weight: 700; color: #b91c1c;">${formatMoney(emp.totalOutstanding)}</td>
          <td>
            <div style="font-size: 6.8pt; color: #78350f;">
              1. <em>Why are ${emp.invoicesPending} invoices still missing/unapproved for completed sites?</em><br/>
              2. <em>What is delaying client payment of ${formatMoney(emp.totalOutstanding)}? Did the branch manager dispute line items or completion?</em><br/>
              3. <em>When was the last written or physical follow-up made?</em>
            </div>
          </td>
          <td>
            <div style="font-size: 6.5pt; color: #94a3b8; margin-bottom: 2px;">Reason / Barrier provided by officer:</div>
            <div class="write-in-line"></div>
            <div class="write-in-line"></div>
            <div style="font-size: 6.5pt; color: #94a3b8; margin-top: 4px; margin-bottom: 2px;">Client contact person &amp; explanation:</div>
            <div class="write-in-line"></div>
          </td>
          <td class="text-center">
            <div class="write-in-line" style="margin-top: 15px;"></div>
            <div style="font-size: 6pt; color: #94a3b8;">DD/MM/YYYY</div>
          </td>
          <td class="text-center">
            <span class="chk-box" style="margin-top: 12px;"></span>
          </td>
        </tr>
`;
      }
    });

    html += `
      </tbody>
    </table>

    <!-- ACTION CHECKLIST FOR MONTH-END CLOSURE -->
    <div style="font-size: 7.8pt; font-weight: 700; color: #92400e; margin-top: 6px;">
      Monthly Management Recovery Checklist &bull; Verification Steps for ${mg.name}:
    </div>
    <div class="action-checklist-grid">
      <div class="action-chk-item">
        <span class="chk-box"></span>
        <span><strong>1. Work Completion Verification:</strong> Confirm that all physical works for ${mg.name} have signed completion slips from branch managers.</span>
      </div>
      <div class="action-chk-item">
        <span class="chk-box"></span>
        <span><strong>2. Immediate Invoice Submission:</strong> Dispatch all pending draft invoices to client zonal offices within 48 hours.</span>
      </div>
      <div class="action-chk-item">
        <span class="chk-box"></span>
        <span><strong>3. Formal Payment Reminder:</strong> Issue written payment demand notices with banking details for balances older than 30 days.</span>
      </div>
      <div class="action-chk-item">
        <span class="chk-box"></span>
        <span><strong>4. Tax Certificate Reconciliation:</strong> Collect withholding tax deduction challans (CPR) from clients to reconcile net cash.</span>
      </div>
      <div class="action-chk-item">
        <span class="chk-box"></span>
        <span><strong>5. Dispute Escalation:</strong> Flag contested quotation line items to Lead Engineer / GM Operations for final settlement.</span>
      </div>
      <div class="action-chk-item">
        <span class="chk-box"></span>
        <span><strong>6. Final Audit Closure Sign-Off:</strong> Admin and Head of Accounts sign-off confirming verified explanations for all pendings.</span>
      </div>
    </div>

    <!-- SIGNATURE BLOCKS -->
    <div style="display: flex; justify-content: space-between; margin-top: 18px; padding-top: 8px; border-top: 1px dashed #fde68a;">
      <div style="width: 28%; font-size: 7pt; color: #78350f;">
        <div>Assigned Lead Officer Signature:</div>
        <div style="border-bottom: 1px solid #78350f; height: 18px; margin-top: 4px;"></div>
      </div>
      <div style="width: 28%; font-size: 7pt; color: #78350f;">
        <div>Internal Auditor / Accounts Signature:</div>
        <div style="border-bottom: 1px solid #78350f; height: 18px; margin-top: 4px;"></div>
      </div>
      <div style="width: 28%; font-size: 7pt; color: #78350f;">
        <div>Managing Director / Final Approval:</div>
        <div style="border-bottom: 1px solid #78350f; height: 18px; margin-top: 4px;"></div>
      </div>
    </div>

  </div>
`;
  });

  html += `
</body>
</html>`;

  const htmlPath = path.join(__dirname, '../All_Months_Pending_Payments_and_Invoices_Checklist.html');
  const pdfPath = path.join(__dirname, '../All_Months_Pending_Payments_and_Invoices_Checklist.pdf');

  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`✓ HTML file written: ${htmlPath}`);

  // Convert HTML to PDF using Chrome / Edge headless
  console.log('Converting HTML to Landscape PDF via Headless Browser...');
  function convertHtmlToPdf(srcHtml, outPdf) {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const browserBin = fs.existsSync(chromePath) ? chromePath : edgePath;
    const fileUrl = `file:///${srcHtml.replace(/\\/g, '/')}`;
    const cmd = `"${browserBin}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${outPdf}" "${fileUrl}"`;
    execSync(cmd, { stdio: 'inherit' });
  }

  try {
    convertHtmlToPdf(htmlPath, pdfPath);
    console.log(`✓ High-Quality PDF generated successfully: ${pdfPath}`);
  } catch (err) {
    console.error('Error converting HTML to PDF:', err);
  }

  await prisma.$disconnect();
  console.log('\nAll checklist files generated successfully!');
}

main().catch(console.error);
