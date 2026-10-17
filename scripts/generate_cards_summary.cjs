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

function formatMoney(num) {
  if (!num && num !== 0) return 'Rs. 0';
  return 'Rs. ' + Math.round(num).toLocaleString('en-US');
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
  console.log('Fetching database records for card summary report...');
  const jobs = await prisma.jobMetadata.findMany({
    select: {
      id: true,
      manualEnteredBy: true,
      createdAt: true,
      paymentStatus: true,
      paymentProgress: true,
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

  console.log(`Fetched ${jobs.length} jobs. Aggregating by tenure and batch...`);

  // Global cards
  const globalCards = {
    totalInvoicesSentCount: 0,
    totalInvoicesSentAmount: 0,
    totalInvoicesPendingCount: 0,
    totalPaymentsSentCount: 0,
    totalPaymentsSentAmount: 0,
    totalPaymentsPendingCount: 0,
    totalPaymentsPendingAmount: 0,
    totalJobs: jobs.length,
  };

  // Batches
  const batchNames = ['Batch 1', 'Batch 2', 'Batch 3', 'Batch 4', 'Unassigned / Office'];
  const batchCards = {};
  batchNames.forEach(b => {
    batchCards[b] = {
      batchName: b,
      totalJobs: 0,
      invoicesSentCount: 0,
      invoicesSentAmount: 0,
      invoicesPendingCount: 0,
      paymentsSentCount: 0,
      paymentsSentAmount: 0,
      paymentsPendingCount: 0,
      paymentsPendingAmount: 0,
      sampleSerials: [],
    };
  });

  // Tenure breakdown
  const monthlyCards = {};

  for (const j of jobs) {
    const rawDate = j.ticket?.exactDate || j.createdAt;
    const mKey = rawDate ? new Date(rawDate).toISOString().slice(0, 7) : '2026-01';

    if (!monthlyCards[mKey]) {
      monthlyCards[mKey] = {
        monthKey: mKey,
        monthName: MONTH_NAMES[mKey] || mKey,
        totalJobs: 0,
        invoicesSentCount: 0,
        invoicesSentAmount: 0,
        invoicesPendingCount: 0,
        paymentsSentCount: 0,
        paymentsSentAmount: 0,
        paymentsPendingCount: 0,
        paymentsPendingAmount: 0,
        batches: {},
      };
      batchNames.forEach(b => {
        monthlyCards[mKey].batches[b] = {
          batchName: b,
          totalJobs: 0,
          invoicesSentCount: 0,
          invoicesSentAmount: 0,
          invoicesPendingCount: 0,
          paymentsSentCount: 0,
          paymentsSentAmount: 0,
          paymentsPendingCount: 0,
          paymentsPendingAmount: 0,
        };
      });
    }

    const mc = monthlyCards[mKey];

    // Determine batch
    const rawEmp = j.ticket?.statusLastChangedBy || j.assignedEmployee?.employeeName || j.manualEnteredBy || j.createdBy?.employeeName;
    const bName = mapToBatchName(rawEmp);
    const bc = batchCards[bName];
    const mbc = mc.batches[bName];

    bc.totalJobs++;
    mbc.totalJobs++;
    mc.totalJobs++;

    const invoices = (j.quotationInvoices || []).filter(q => q.documentType === 'INVOICE');
    const quotations = (j.quotationInvoices || []).filter(q => q.documentType === 'QUOTATION');

    const totalInvoice = invoices.reduce((s, inv) => s + parseLineItemsTotal(inv.lineItems), 0);
    const totalQuotation = quotations.reduce((s, q) => s + parseLineItemsTotal(q.lineItems), 0);
    const netReceived = (j.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const taxDeducted = (j.payments || []).reduce((s, p) => s + (Number(p.taxDeducted) || 0), 0);
    const grossPayment = netReceived + taxDeducted;

    const baseAmount = totalInvoice > 0 ? totalInvoice : totalQuotation;
    const balanceDue = Math.max(0, baseAmount - grossPayment);

    // 1. Invoices Sent
    if (invoices.length > 0) {
      globalCards.totalInvoicesSentCount += invoices.length;
      globalCards.totalInvoicesSentAmount += totalInvoice;
      bc.invoicesSentCount += invoices.length;
      bc.invoicesSentAmount += totalInvoice;
      mbc.invoicesSentCount += invoices.length;
      mbc.invoicesSentAmount += totalInvoice;
      mc.invoicesSentCount += invoices.length;
      mc.invoicesSentAmount += totalInvoice;
    }

    // 2. Invoices Pending
    const hasApprovedInvoice = invoices.some(i => i.status === 'APPROVED' || i.status === 'PAID');
    const isInvoicePending = invoices.length === 0 || !hasApprovedInvoice;
    if (isInvoicePending) {
      globalCards.totalInvoicesPendingCount++;
      bc.invoicesPendingCount++;
      mbc.invoicesPendingCount++;
      mc.invoicesPendingCount++;
    }

    // 3. Payments Sent / Received
    if (grossPayment > 0) {
      const payCount = (j.payments || []).length || 1;
      globalCards.totalPaymentsSentCount += payCount;
      globalCards.totalPaymentsSentAmount += grossPayment;
      bc.paymentsSentCount += payCount;
      bc.paymentsSentAmount += grossPayment;
      mbc.paymentsSentCount += payCount;
      mbc.paymentsSentAmount += grossPayment;
      mc.paymentsSentCount += payCount;
      mc.paymentsSentAmount += grossPayment;
    }

    // 4. Payments Pending
    const isPaymentPending = (j.paymentStatus !== 'PAID') || balanceDue > 0;
    if (isPaymentPending) {
      globalCards.totalPaymentsPendingCount++;
      globalCards.totalPaymentsPendingAmount += balanceDue;
      bc.paymentsPendingCount++;
      bc.paymentsPendingAmount += balanceDue;
      mbc.paymentsPendingCount++;
      mbc.paymentsPendingAmount += balanceDue;
      mc.paymentsPendingCount++;
      mc.paymentsPendingAmount += balanceDue;
    }

    if (bc.sampleSerials.length < 5 && j.ticket?.serialNo) {
      bc.sampleSerials.push(j.ticket.serialNo);
    }
  }

  const sortedMonthKeys = Object.keys(monthlyCards).sort();

  // -------------------------------------------------------------
  // 1. GENERATE CARDS SUMMARY EXCEL WORKBOOK (.XLSX)
  // -------------------------------------------------------------
  console.log('Building Cards Summary Excel...');
  const wb = XLSX.utils.book_new();

  // 1A. Overall Cards Sheet
  const overallRows = [
    ['NEXUS OPERATIONS — EXECUTIVE AUDIT CARDS SUMMARY'],
    ['Generated Date:', new Date().toLocaleString()],
    ['Scope:', 'Tenure Wise Cards Summary (No individual line-item clutter)'],
    [],
    ['EXECUTIVE OVERVIEW CARDS (FULL TENURE: JAN 2026 – OCT 2026)'],
    ['Card Metric', 'Count / Quantity', 'Financial Value (PKR)', 'Status & Definition'],
    ['TOTAL INVOICES SENT', globalCards.totalInvoicesSentCount, globalCards.totalInvoicesSentAmount, 'Tax invoices generated & dispatched'],
    ['TOTAL INVOICES PENDING', globalCards.totalInvoicesPendingCount, '—', 'Complaints awaiting invoice creation or approval'],
    ['TOTAL PAYMENTS SENT / RECEIVED', globalCards.totalPaymentsSentCount, globalCards.totalPaymentsSentAmount, 'Cash payments collected + Tax credits'],
    ['TOTAL PAYMENTS PENDING', globalCards.totalPaymentsPendingCount, globalCards.totalPaymentsPendingAmount, 'Uncollected balance awaiting recovery from client accounts'],
    [],
    ['BATCH AUDIT CARDS SUMMARY (BY BATCH NAME)'],
    ['Batch Name', 'Total Complaints', 'Invoices Sent (Count)', 'Invoices Sent (PKR)', 'Invoices Pending (Count)', 'Payments Received (PKR)', 'Payments Pending (Count)', 'Payments Pending (PKR Due)', 'End-of-Month Audit Inquiry: Why are these pendings?'],
  ];

  batchNames.forEach(b => {
    const card = batchCards[b];
    overallRows.push([
      card.batchName,
      card.totalJobs,
      card.invoicesSentCount,
      card.invoicesSentAmount,
      card.invoicesPendingCount,
      card.paymentsSentAmount,
      card.paymentsPendingCount,
      card.paymentsPendingAmount,
      `Inquire ${card.batchName} on why ${card.invoicesPendingCount} invoices are pending and Rs. ${Math.round(card.paymentsPendingAmount).toLocaleString()} payment is uncollected.`
    ]);
  });

  const wsOverall = XLSX.utils.aoa_to_sheet(overallRows);
  XLSX.utils.book_append_sheet(wb, wsOverall, 'Executive_Cards');

  // 1B. Monthly Cards Matrix Sheet
  const monthlyRows = [
    ['TENURE-WISE MONTHLY CARDS MATRIX (JANUARY 2026 – OCTOBER 2026)'],
    [],
    ['Tenure Month', 'Total Complaints', 'Invoices Sent (Count)', 'Invoices Sent (PKR)', 'Invoices Pending (Count)', 'Payments Received (PKR)', 'Payments Pending (Count)', 'Payments Pending (PKR Due)', 'Batch 1 Balance', 'Batch 2 Balance', 'Batch 3 Balance', 'Batch 4 Balance', 'Office/Unassigned Balance']
  ];

  sortedMonthKeys.forEach(mKey => {
    const mc = monthlyCards[mKey];
    monthlyRows.push([
      mc.monthName,
      mc.totalJobs,
      mc.invoicesSentCount,
      mc.invoicesSentAmount,
      mc.invoicesPendingCount,
      mc.paymentsSentAmount,
      mc.paymentsPendingCount,
      mc.paymentsPendingAmount,
      mc.batches['Batch 1'].paymentsPendingAmount,
      mc.batches['Batch 2'].paymentsPendingAmount,
      mc.batches['Batch 3'].paymentsPendingAmount,
      mc.batches['Batch 4'].paymentsPendingAmount,
      mc.batches['Unassigned / Office'].paymentsPendingAmount,
    ]);
  });

  const wsMonthly = XLSX.utils.aoa_to_sheet(monthlyRows);
  XLSX.utils.book_append_sheet(wb, wsMonthly, 'Tenure_Cards_Matrix');

  const xlsxPath = path.join(__dirname, '../public/reports/Cards_Summary_Pending_Audit.xlsx');
  XLSX.writeFile(wb, xlsxPath);
  console.log(`✓ Excel Cards Summary generated: ${xlsxPath}`);

  // -------------------------------------------------------------
  // 2. GENERATE CARDS SUMMARY CSV (.CSV)
  // -------------------------------------------------------------
  console.log('Building Cards Summary CSV...');
  const csvLines = [
    'Section,Batch / Tenure,Complaints Count,Invoices Sent Count,Invoices Sent PKR,Invoices Pending Count,Payments Received PKR,Payments Pending Count,Payments Pending PKR Due,Audit Inquiry Question'
  ];

  batchNames.forEach(b => {
    const card = batchCards[b];
    csvLines.push(`"Batch Card","${card.batchName}",${card.totalJobs},${card.invoicesSentCount},${card.invoicesSentAmount},${card.invoicesPendingCount},${card.paymentsSentAmount},${card.paymentsPendingCount},${card.paymentsPendingAmount},"Why are ${card.invoicesPendingCount} invoices pending and Rs. ${Math.round(card.paymentsPendingAmount)} uncollected for ${card.batchName}?"`);
  });

  sortedMonthKeys.forEach(mKey => {
    const mc = monthlyCards[mKey];
    csvLines.push(`"Tenure Card","${mc.monthName}",${mc.totalJobs},${mc.invoicesSentCount},${mc.invoicesSentAmount},${mc.invoicesPendingCount},${mc.paymentsSentAmount},${mc.paymentsPendingCount},${mc.paymentsPendingAmount},"Why are ${mc.invoicesPendingCount} invoices pending and Rs. ${Math.round(mc.paymentsPendingAmount)} uncollected for tenure ${mc.monthName}?"`);
  });

  const csvPath = path.join(__dirname, '../public/reports/Cards_Summary_Pending_Audit.csv');
  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8');
  console.log(`✓ CSV Cards Summary generated: ${csvPath}`);

  // -------------------------------------------------------------
  // 3. GENERATE CARDS-ONLY EXECUTIVE PDF (.PDF)
  // -------------------------------------------------------------
  console.log('Building Cards-Only Executive PDF HTML...');
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Executive Pending Audit Cards Summary</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@600;800&display=swap');
    
    @page {
      size: A4 portrait;
      margin: 12mm 12mm 14mm 12mm;
      @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        font-family: 'Inter', sans-serif;
        font-size: 8pt;
        color: #94a3b8;
      }
      @bottom-left {
        content: "NEXUS OPERATIONS — Executive Cards Summary (Tenure & Batch Wise)";
        font-family: 'Inter', sans-serif;
        font-size: 8pt;
        color: #94a3b8;
      }
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', sans-serif;
      font-size: 8.5pt;
      line-height: 1.4;
      color: #0f172a;
      background: #ffffff;
      padding: 4px;
    }

    .report-header {
      border-bottom: 2.5px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 20px;
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
      font-size: 9pt;
      color: #64748b;
      margin-top: 3px;
    }

    .section-title {
      font-size: 11pt;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* 4 BIG METRIC CARDS */
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
      margin-bottom: 24px;
      page-break-inside: avoid;
    }

    .metric-card {
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px 18px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.03);
    }

    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .card-badge {
      font-size: 7.5pt;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
      text-transform: uppercase;
    }

    .card-label {
      font-size: 8.5pt;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .card-primary-val {
      font-family: 'JetBrains Mono', monospace;
      font-size: 22pt;
      font-weight: 800;
      line-height: 1.1;
      margin-bottom: 4px;
    }

    .card-secondary-val {
      font-size: 9pt;
      color: #64748b;
      font-weight: 500;
    }

    /* BATCH CARDS */
    .batch-cards-container {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
      margin-bottom: 24px;
      page-break-inside: avoid;
    }

    .batch-card {
      background: #ffffff;
      border: 1.5px solid #cbd5e1;
      border-radius: 10px;
      padding: 14px 16px;
      border-top: 4px solid #4f46e5;
    }

    .batch-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 8px;
    }

    .batch-title {
      font-size: 12pt;
      font-weight: 800;
      color: #0f172a;
    }

    .batch-complaints {
      font-size: 8pt;
      font-weight: 600;
      color: #64748b;
    }

    .batch-stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 12px;
    }

    .mini-stat {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 10px;
    }

    .mini-label {
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 2px;
    }

    .mini-val {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11pt;
      font-weight: 800;
      color: #0f172a;
    }

    .mini-sub {
      font-size: 7pt;
      color: #94a3b8;
    }

    .batch-inquiry-box {
      background: #fffbeb;
      border: 1px dashed #f59e0b;
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 7.5pt;
      color: #78350f;
    }

    /* TENURE MATRIX */
    .tenure-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      page-break-inside: avoid;
    }

    .tenure-table th {
      background: #0f172a;
      color: #ffffff;
      font-size: 7pt;
      font-weight: 600;
      text-transform: uppercase;
      padding: 6px 8px;
      text-align: left;
    }

    .tenure-table td {
      border: 1px solid #e2e8f0;
      padding: 6px 8px;
      font-size: 7.5pt;
    }

    .tenure-table tr:nth-child(even) td {
      background: #f8fafc;
    }

    .mono { font-family: 'JetBrains Mono', monospace; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }

    .page-break { page-break-before: always; }
  </style>
</head>
<body>

  <!-- HEADER -->
  <div class="report-header">
    <div>
      <div style="font-size: 8pt; color: #4f46e5; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">
        NEXUS OPERATIONS &bull; EXECUTIVE AUDIT CARDS
      </div>
      <div class="report-title">
        Pending Invoices &amp; Payments Cards Summary
      </div>
      <div class="report-subtitle">
        Tenure: <strong>All Months (January 2026 – October 2026)</strong> &bull; Grouped Strictly by <strong>Batch Names</strong>
      </div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 13pt; font-weight: 800; color: #dc2626;">${formatMoney(globalCards.totalPaymentsPendingAmount)} Due</div>
      <div style="font-size: 7.5pt; color: #64748b;">Generated on ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
    </div>
  </div>

  <!-- SECTION 1: 4 EXECUTIVE OVERVIEW CARDS -->
  <div class="section-title">📊 Executive Metric Cards (Full Tenure)</div>
  <div class="metric-grid">
    
    <!-- CARD 1: INVOICES SENT -->
    <div class="metric-card" style="border-left: 5px solid #0284c7;">
      <div class="card-top">
        <span class="card-label">Total Invoices Sent</span>
        <span class="card-badge" style="background: #e0f2fe; color: #0369a1;">Dispatched</span>
      </div>
      <div class="card-primary-val" style="color: #0284c7;">
        ${globalCards.totalInvoicesSentCount} <span style="font-size: 13pt; font-weight: 600;">Invoices</span>
      </div>
      <div class="card-secondary-val">
        Total Billed Volume: <strong>${formatMoney(globalCards.totalInvoicesSentAmount)}</strong>
      </div>
    </div>

    <!-- CARD 2: INVOICES PENDING -->
    <div class="metric-card" style="border-left: 5px solid #f59e0b;">
      <div class="card-top">
        <span class="card-label">Total Invoices Pending</span>
        <span class="card-badge" style="background: #fef3c7; color: #b45309;">Awaiting Billing</span>
      </div>
      <div class="card-primary-val" style="color: #d97706;">
        ${globalCards.totalInvoicesPendingCount} <span style="font-size: 13pt; font-weight: 600;">Complaints</span>
      </div>
      <div class="card-secondary-val">
        Sites completed but missing tax invoices / customer sign-offs
      </div>
    </div>

    <!-- CARD 3: PAYMENTS SENT / RECEIVED -->
    <div class="metric-card" style="border-left: 5px solid #10b981;">
      <div class="card-top">
        <span class="card-label">Total Payments Sent / Received</span>
        <span class="card-badge" style="background: #dcfce7; color: #15803d;">Collected</span>
      </div>
      <div class="card-primary-val" style="color: #10b981;">
        ${formatMoney(globalCards.totalPaymentsSentAmount)}
      </div>
      <div class="card-secondary-val">
        Recovered via <strong>${globalCards.totalPaymentsSentCount} Transactions</strong> (Cash &amp; Tax Deductions)
      </div>
    </div>

    <!-- CARD 4: PAYMENTS PENDING -->
    <div class="metric-card" style="border-left: 5px solid #dc2626;">
      <div class="card-top">
        <span class="card-label">Total Payments Pending</span>
        <span class="card-badge" style="background: #fee2e2; color: #991b1b;">Overdue Balance</span>
      </div>
      <div class="card-primary-val" style="color: #dc2626;">
        ${formatMoney(globalCards.totalPaymentsPendingAmount)}
      </div>
      <div class="card-secondary-val">
        Outstanding across <strong>${globalCards.totalPaymentsPendingCount} Complaints</strong> awaiting recovery
      </div>
    </div>

  </div>

  <!-- SECTION 2: BATCH CARDS (BATCH NAMES ONLY) -->
  <div class="section-title">👥 Batch Performance &amp; Pending Cards</div>
  <div class="batch-cards-container">
    
    ${batchNames.map(b => {
      const c = batchCards[b];
      const borderColor = b === 'Batch 1' ? '#3b82f6' : b === 'Batch 2' ? '#10b981' : b === 'Batch 3' ? '#f59e0b' : b === 'Batch 4' ? '#8b5cf6' : '#64748b';
      return `
      <div class="batch-card" style="border-top-color: ${borderColor};">
        <div class="batch-header">
          <div class="batch-title" style="color: ${borderColor};">${c.batchName}</div>
          <div class="batch-complaints">${c.totalJobs} Total Complaints</div>
        </div>

        <div class="batch-stats-grid">
          <div class="mini-stat">
            <div class="mini-label">Invoices Sent</div>
            <div class="mini-val" style="color: #0284c7;">${c.invoicesSentCount}</div>
            <div class="mini-sub">${formatMoney(c.invoicesSentAmount)}</div>
          </div>

          <div class="mini-stat">
            <div class="mini-label">Invoices Pending</div>
            <div class="mini-val" style="color: #d97706;">${c.invoicesPendingCount}</div>
            <div class="mini-sub">Needs Invoice</div>
          </div>

          <div class="mini-stat">
            <div class="mini-label">Payments Received</div>
            <div class="mini-val" style="color: #10b981;">${formatMoney(c.paymentsSentAmount)}</div>
            <div class="mini-sub">${c.paymentsSentCount} Transactions</div>
          </div>

          <div class="mini-stat">
            <div class="mini-label">Payments Pending</div>
            <div class="mini-val" style="color: #dc2626;">${formatMoney(c.paymentsPendingAmount)}</div>
            <div class="mini-sub">${c.paymentsPendingCount} Pending</div>
          </div>
        </div>

        <div class="batch-inquiry-box">
          <strong>Mandatory Audit Inquiry:</strong> Why does ${c.batchName} have <strong>${c.invoicesPendingCount} invoices pending</strong> and <strong>${formatMoney(c.paymentsPendingAmount)} uncollected payments</strong>?
          <div style="margin-top: 4px; border-bottom: 1px dashed #cbd5e1; height: 12px;"></div>
        </div>
      </div>
      `;
    }).join('')}

  </div>

  <div class="page-break"></div>

  <!-- SECTION 3: TENURE-WISE MONTHLY CARDS MATRIX -->
  <div class="section-title">📅 Tenure-Wise Monthly Cards Matrix (All Months)</div>
  <table class="tenure-table">
    <thead>
      <tr>
        <th>Tenure Month</th>
        <th class="text-center">Total</th>
        <th class="text-center">Invoices Sent</th>
        <th class="text-right">Invoiced (PKR)</th>
        <th class="text-center">Invoices Pending</th>
        <th class="text-right">Recovered (PKR)</th>
        <th class="text-center">Payments Pending</th>
        <th class="text-right">Pending Balance (PKR)</th>
        <th class="text-right">Batch 1 Due</th>
        <th class="text-right">Batch 2 Due</th>
        <th class="text-right">Batch 3 Due</th>
        <th class="text-right">Batch 4 Due</th>
      </tr>
    </thead>
    <tbody>
      ${sortedMonthKeys.map(mKey => {
        const mc = monthlyCards[mKey];
        return `
        <tr>
          <td style="font-weight: 700;">${mc.monthName}</td>
          <td class="text-center mono">${mc.totalJobs}</td>
          <td class="text-center mono" style="color: #0284c7;">${mc.invoicesSentCount}</td>
          <td class="text-right mono">${formatMoney(mc.invoicesSentAmount)}</td>
          <td class="text-center mono" style="color: #d97706; font-weight: 700;">${mc.invoicesPendingCount}</td>
          <td class="text-right mono" style="color: #10b981;">${formatMoney(mc.paymentsSentAmount)}</td>
          <td class="text-center mono" style="color: #dc2626; font-weight: 700;">${mc.paymentsPendingCount}</td>
          <td class="text-right mono" style="font-weight: 800; color: #dc2626;">${formatMoney(mc.paymentsPendingAmount)}</td>
          <td class="text-right mono">${formatMoney(mc.batches['Batch 1'].paymentsPendingAmount)}</td>
          <td class="text-right mono">${formatMoney(mc.batches['Batch 2'].paymentsPendingAmount)}</td>
          <td class="text-right mono">${formatMoney(mc.batches['Batch 3'].paymentsPendingAmount)}</td>
          <td class="text-right mono">${formatMoney(mc.batches['Batch 4'].paymentsPendingAmount)}</td>
        </tr>
        `;
      }).join('')}
    </tbody>
  </table>

  <!-- SIGNATURE BLOCKS -->
  <div style="display: flex; justify-content: space-between; margin-top: 36px; padding-top: 12px; border-top: 1.5px dashed #cbd5e1;">
    <div style="width: 30%; font-size: 8pt; color: #475569;">
      <div>Recovery Operations Sign-Off:</div>
      <div style="border-bottom: 1px solid #475569; height: 24px; margin-top: 6px;"></div>
    </div>
    <div style="width: 30%; font-size: 8pt; color: #475569;">
      <div>Internal Audit &amp; Reconciliation:</div>
      <div style="border-bottom: 1px solid #475569; height: 24px; margin-top: 6px;"></div>
    </div>
    <div style="width: 30%; font-size: 8pt; color: #475569;">
      <div>Managing Director Sign-Off:</div>
      <div style="border-bottom: 1px solid #475569; height: 24px; margin-top: 6px;"></div>
    </div>
  </div>

</body>
</html>`;

  const htmlPath = path.join(__dirname, '../public/reports/Cards_Summary_Pending_Audit.html');
  const pdfPath = path.join(__dirname, '../public/reports/Cards_Summary_Pending_Audit.pdf');

  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`✓ Cards HTML generated: ${htmlPath}`);

  // Convert to PDF via headless browser
  console.log('Converting Cards HTML to Portrait PDF...');
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browserBin = fs.existsSync(chromePath) ? chromePath : edgePath;
  const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;
  const cmd = `"${browserBin}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdfPath}" "${fileUrl}"`;
  execSync(cmd, { stdio: 'inherit' });
  console.log(`✓ Cards-Only PDF generated: ${pdfPath}`);

  await prisma.$disconnect();
}

main().catch(console.error);
