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
  console.log('Fetching database records for Domain Overview cards...');
  const jobs = await prisma.jobMetadata.findMany({
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

  console.log(`Fetched ${jobs.length} jobs.`);

  const batchNames = ['Batch No. 01', 'Batch No. 02', 'Batch No. 03', 'Batch No. 04'];

  // Global / Domain Overview Card
  const domainOverview = {
    totalComplaints: 0,
    paymentReceived: 0,
    paymentPending: 0,
    poPending: 0,
    inprocess: 0,
    cancel: 0,
  };

  // Batches Cards Map
  const batchCards = {};
  batchNames.forEach(b => {
    batchCards[b] = {
      batchName: b,
      totalComplaints: 0,
      paymentReceived: 0,
      paymentPending: 0,
      poPending: 0,
      inprocess: 0,
      cancel: 0,
    };
  });

  // Monthly / Tenure Cards Map
  const monthlyCards = {};

  for (const j of jobs) {
    const rawEmp = j.ticket?.statusLastChangedBy || j.assignedEmployee?.employeeName || j.manualEnteredBy || j.createdBy?.employeeName;
    const bName = mapToBatchName(rawEmp);

    // Skip unassigned and admin complaints so they are not considered in the 4 operational batches audit
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
        batches: {},
      };
      batchNames.forEach(b => {
        monthlyCards[mKey].batches[b] = {
          batchName: b,
          totalComplaints: 0,
          paymentReceived: 0,
          paymentPending: 0,
          poPending: 0,
          inprocess: 0,
          cancel: 0,
        };
      });
    }

    const mc = monthlyCards[mKey];
    const bc = batchCards[bName];
    const mbc = mc.batches[bName];

    // Increment Total
    domainOverview.totalComplaints++;
    bc.totalComplaints++;
    mbc.totalComplaints++;
    mc.totalComplaints++;

    // 1. Cancel Check
    const isCancel = j.ticket?.status === 'CANCELLED' || j.workCompletion?.status === 'CANCELLED';
    if (isCancel) {
      domainOverview.cancel++;
      bc.cancel++;
      mbc.cancel++;
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
      mbc.paymentReceived++;
      mc.paymentReceived++;
    } else if (invoices.length > 0 || (j.payments || []).length > 0 || j.paymentStatus === 'PARTIAL') {
      domainOverview.paymentPending++;
      bc.paymentPending++;
      mbc.paymentPending++;
      mc.paymentPending++;
    } else if (!hasPO && quotations.length > 0) {
      domainOverview.poPending++;
      bc.poPending++;
      mbc.poPending++;
      mc.poPending++;
    } else {
      domainOverview.inprocess++;
      bc.inprocess++;
      mbc.inprocess++;
      mc.inprocess++;
    }
  }

  const sortedMonthKeys = Object.keys(monthlyCards).sort();

  // -------------------------------------------------------------
  // 1. GENERATE EXCEL WITH EXACT CARD FORMAT (.XLSX)
  // -------------------------------------------------------------
  console.log('Generating Excel Domain Overview Cards...');
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
      [bc.batchName],
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

  // Tenure-wise cards sheet
  const tenureExcelRows = [
    ['Domain Overview — Tenure Wise Cards'],
    []
  ];

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

  const xlsxPath = path.join(__dirname, '../public/reports/Cards_Summary_Pending_Audit.xlsx');
  XLSX.writeFile(wb, xlsxPath);
  console.log(`✓ Excel Cards generated: ${xlsxPath}`);

  // -------------------------------------------------------------
  // 2. GENERATE CSV WITH EXACT CARD FORMAT (.CSV)
  // -------------------------------------------------------------
  console.log('Generating CSV Domain Overview Cards...');
  const csvLines = [
    'Card Title,Batch / Tenure,Metric Name,Value'
  ];

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

  const csvPath = path.join(__dirname, '../public/reports/Cards_Summary_Pending_Audit.csv');
  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8');
  console.log(`✓ CSV Cards generated: ${csvPath}`);

  // -------------------------------------------------------------
  // 3. GENERATE HIGH-RES PDF WITH EXACT CARD FORMAT (.PDF)
  // -------------------------------------------------------------
  console.log('Building PDF with exact Domain Overview Card format...');

  function renderDomainCardHtml(batchTitle, dataObj) {
    return `
      <div class="domain-card">
        <div class="domain-card-header">Domain Overview</div>
        <div class="domain-card-batch">${batchTitle}</div>
        <table class="domain-table">
          <tbody>
            <tr>
              <td class="domain-label">Total no of Complaints</td>
              <td class="domain-value">${dataObj.totalComplaints}</td>
            </tr>
            <tr>
              <td class="domain-label">Total no of Payment Received Cases</td>
              <td class="domain-value">${dataObj.paymentReceived}</td>
            </tr>
            <tr>
              <td class="domain-label">Total no of Payment Pending Cases</td>
              <td class="domain-value">${dataObj.paymentPending}</td>
            </tr>
            <tr>
              <td class="domain-label">Total no of PO Pending Cases</td>
              <td class="domain-value">${dataObj.poPending}</td>
            </tr>
            <tr>
              <td class="domain-label">Total no of Inprocess Cases</td>
              <td class="domain-value">${dataObj.inprocess}</td>
            </tr>
            <tr>
              <td class="domain-label">Total no of Cancel Cases</td>
              <td class="domain-value">${dataObj.cancel}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Domain Overview Cards Summary</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@600;800&display=swap');

    @page {
      size: A4 portrait;
      margin: 12mm 14mm 14mm 14mm;
      @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        font-family: 'Inter', sans-serif;
        font-size: 8pt;
        color: #94a3b8;
      }
      @bottom-left {
        content: "NEXUS OPERATIONS — Domain Overview Cards Summary";
        font-family: 'Inter', sans-serif;
        font-size: 8pt;
        color: #94a3b8;
      }
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      color: #000000;
      background: #ffffff;
      padding: 6px;
    }

    .report-title {
      font-size: 16pt;
      font-weight: 800;
      color: #000000;
      text-align: center;
      margin-bottom: 4px;
      letter-spacing: -0.3px;
    }

    .report-subtitle {
      font-size: 9pt;
      color: #4b5563;
      text-align: center;
      margin-bottom: 24px;
    }

    .cards-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
      align-items: center;
    }

    .cards-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      width: 100%;
      page-break-inside: avoid;
    }

    /* EXACT CARD FORMAT FROM USER SCREENSHOT */
    .domain-card {
      width: 100%;
      max-width: 480px;
      margin: 0 auto;
      border: 1.8px solid #000000;
      background: #ffffff;
      page-break-inside: avoid;
    }

    .domain-card-header {
      font-size: 15pt;
      font-weight: 700;
      text-align: center;
      padding: 6px 10px;
      border-bottom: 1.8px solid #000000;
      color: #000000;
      font-family: 'Times New Roman', Times, serif, 'Inter', sans-serif;
      letter-spacing: 0.3px;
    }

    .domain-card-batch {
      font-size: 11pt;
      font-weight: 800;
      padding: 4px 10px;
      border-bottom: 1.8px solid #000000;
      color: #000000;
      font-family: 'Times New Roman', Times, serif, 'Inter', sans-serif;
    }

    .domain-table {
      width: 100%;
      border-collapse: collapse;
    }

    .domain-table tr {
      border-bottom: 1.5px solid #000000;
    }

    .domain-table tr:last-child {
      border-bottom: none;
    }

    .domain-label {
      padding: 5px 12px;
      font-size: 9.5pt;
      text-align: center;
      border-right: 1.8px solid #000000;
      width: 68%;
      color: #000000;
      font-family: 'Times New Roman', Times, serif, 'Inter', sans-serif;
    }

    .domain-value {
      padding: 5px 12px;
      font-size: 10.5pt;
      font-weight: 500;
      text-align: center;
      width: 32%;
      color: #000000;
      font-family: 'Times New Roman', Times, serif, 'Inter', sans-serif;
    }

    .page-break { page-break-before: always; }
  </style>
</head>
<body>

  <div class="report-title">NEXUS OPERATIONS &bull; DOMAIN OVERVIEW</div>
  <div class="report-subtitle">Tenure: Full Year 2026 &bull; Performance &amp; Case Audit by Batch</div>

  <!-- OVERALL DOMAIN OVERVIEW CARD -->
  <div style="margin-bottom: 24px;">
    ${renderDomainCardHtml('Overall Domain Overview (All Batches)', domainOverview)}
  </div>

  <!-- INDIVIDUAL BATCH CARDS (2-COLUMN GRID) -->
  <div class="cards-grid">
    ${renderDomainCardHtml('Batch No. 01', batchCards['Batch No. 01'])}
    ${renderDomainCardHtml('Batch No. 02', batchCards['Batch No. 02'])}
    ${renderDomainCardHtml('Batch No. 03', batchCards['Batch No. 03'])}
    ${renderDomainCardHtml('Batch No. 04', batchCards['Batch No. 04'])}
  </div>

  <div class="page-break"></div>

  <div class="report-title" style="margin-top: 10px;">TENURE-WISE DOMAIN OVERVIEW CARDS</div>
  <div class="report-subtitle">Month-by-Month Case Status Breakdown</div>

  <div class="cards-grid">
    ${sortedMonthKeys.map(mKey => {
      return renderDomainCardHtml(`Tenure: ${monthlyCards[mKey].monthName}`, monthlyCards[mKey]);
    }).join('')}
  </div>

</body>
</html>`;

  const htmlPath = path.join(__dirname, '../public/reports/Cards_Summary_Pending_Audit.html');
  const pdfPath = path.join(__dirname, '../public/reports/Cards_Summary_Pending_Audit.pdf');

  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`✓ HTML generated: ${htmlPath}`);

  // Convert to PDF via headless browser
  console.log('Converting HTML to PDF...');
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browserBin = fs.existsSync(chromePath) ? chromePath : edgePath;
  const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;
  const cmd = `"${browserBin}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdfPath}" "${fileUrl}"`;
  execSync(cmd, { stdio: 'inherit' });
  console.log(`✓ PDF generated: ${pdfPath}`);

  await prisma.$disconnect();
}

main().catch(console.error);
