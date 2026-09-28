const { PrismaClient } = require('../src/generated/client/index.js');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.cheqzrvucqlrdtlvfirk:anie%401234%231234@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
    }
  }
});

function getTicketEntryPerson(ticket) {
  return ticket.statusLastChangedBy ||
    ticket.jobMetadata?.assignedEmployee?.employeeName ||
    ticket.jobMetadata?.createdBy?.employeeName ||
    ticket.jobMetadata?.manualEnteredBy ||
    'Unassigned / Auto-Ingested';
}

function mapEmployeeBatchName(name) {
  if (!name) return 'Unassigned / Auto-Ingested';
  const lower = name.toLowerCase().trim();
  if (lower.includes('rizwan')) return 'Ali Shehzad (Batch 1)';
  if (lower.includes('ibrahim')) return 'Muhammad Ibrahim (Batch 2)';
  if (lower.includes('shahzaib') || lower.includes('shah zaib')) return 'Shah Zaib (Batch 3)';
  if (lower.includes('sermad') || lower.includes('sarmad')) return 'Sarmad Islam (Batch 4)';
  if (lower.includes('ali shezad') || lower.includes('ali shehzad')) return 'Ali Shehzad (Batch 1)';
  return 'Unassigned / Auto-Ingested';
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

function formatDate(dateVal) {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getStatusBadge(ticket) {
  if (ticket.jobMetadata) {
    return '<span class="badge badge-green">✓ Intake Done</span>';
  }
  if (ticket.status === 'CANCELLED') {
    return '<span class="badge badge-red">✕ Cancelled</span>';
  }
  if (ticket.status === 'RELEVANT') {
    return '<span class="badge badge-blue">● Relevant</span>';
  }
  return '<span class="badge badge-gray">⏳ Pending</span>';
}

function convertHtmlToPdf(htmlPath, pdfPath) {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browserBin = fs.existsSync(chromePath) ? chromePath : edgePath;
  
  const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;
  const cmd = `"${browserBin}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdfPath}" "${fileUrl}"`;
  execSync(cmd, { stdio: 'inherit' });
}

function getBaseCss(accentColor = '#4f46e5') {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
    
    @page {
      size: A4 landscape;
      margin: 12mm 10mm 12mm 10mm;
      @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        font-family: 'Inter', sans-serif;
        font-size: 8pt;
        color: #94a3b8;
      }
      @bottom-left {
        content: "NEXUS Operations — Employee Complaints Progress Audit (August 2026)";
        font-family: 'Inter', sans-serif;
        font-size: 8pt;
        color: #94a3b8;
      }
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 8.5pt;
      line-height: 1.4;
      padding: 10px;
    }

    .report-header {
      border-bottom: 2px solid #0f172a;
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
      font-size: 9.5pt;
      color: #64748b;
      margin-top: 3px;
    }

    .batch-badge {
      display: inline-block;
      background: ${accentColor};
      color: #ffffff;
      font-weight: 700;
      font-size: 8pt;
      padding: 3px 8px;
      border-radius: 4px;
      margin-left: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      vertical-align: middle;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 18px;
      page-break-inside: avoid;
    }

    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
      border-top: 4px solid ${accentColor};
    }

    .summary-label {
      font-size: 7.5pt;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .summary-count {
      font-size: 20pt;
      font-weight: 800;
      color: #0f172a;
      line-height: 1;
    }

    .summary-subtext {
      font-size: 7.5pt;
      color: #94a3b8;
      margin-top: 4px;
    }

    .section-header {
      background: #0f172a;
      color: #ffffff;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 10pt;
      font-weight: 700;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 16px;
      margin-bottom: 10px;
      page-break-after: avoid;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
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
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 7px 8px;
      border-bottom: 2px solid #cbd5e1;
      text-align: left;
    }

    td {
      padding: 7px 8px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
      font-size: 8pt;
    }

    tr:nth-child(even) td {
      background-color: #fafafa;
    }

    .serial-col {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      color: ${accentColor};
      width: 85px;
      white-space: nowrap;
    }

    .date-col {
      width: 105px;
      white-space: nowrap;
    }

    .client-col {
      width: 180px;
      line-height: 1.3;
    }

    .sender-col {
      width: 160px;
      font-size: 7.5pt;
      color: #475569;
      word-break: break-all;
    }

    .subject-col {
      line-height: 1.35;
    }

    .status-col {
      width: 105px;
      text-align: center;
      white-space: nowrap;
    }

    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .badge-green { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
    .badge-blue { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
    .badge-red { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
    .badge-gray { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
  `;
}

function renderTableRows(tickets, accentColor) {
  if (tickets.length === 0) {
    return `<tr><td colspan="6" style="text-align:center; padding: 16px; color: #94a3b8;">No complaints recorded for this employee in August 2026.</td></tr>`;
  }

  return tickets.map((t, idx) => {
    let clientBranch = '—';
    if (t.jobMetadata) {
      clientBranch = `<strong>${escapeHtml(t.jobMetadata.clientName || '')}</strong>`;
      if (t.jobMetadata.branchName) {
        clientBranch += `<br><span style="color:#64748b;">${escapeHtml(t.jobMetadata.branchName)}</span>`;
      }
      if (t.jobMetadata.workNature) {
        clientBranch += `<br><span style="color:${accentColor}; font-size: 7pt; font-weight:600;">${escapeHtml(t.jobMetadata.workNature)}</span>`;
      }
    }

    return `
      <tr>
        <td class="serial-col">${escapeHtml(t.serialNo || t.id)}</td>
        <td class="date-col">
          <strong>${formatDate(t.exactDate)}</strong><br>
          <span style="color: #64748b; font-size: 7pt;">${escapeHtml(t.time || '')}</span>
        </td>
        <td class="client-col">${clientBranch}</td>
        <td class="sender-col">${escapeHtml(t.sender)}</td>
        <td class="subject-col">
          <strong>${escapeHtml(t.subject)}</strong>
        </td>
        <td class="status-col">${getStatusBadge(t)}</td>
      </tr>
    `;
  }).join('');
}

async function main() {
  console.log('Fetching August 2026 tickets without irrelevant status...');
  const allTickets = await prisma.ticket.findMany({
    include: {
      jobMetadata: {
        include: {
          assignedEmployee: true,
          createdBy: true
        }
      },
      createdBy: true
    },
    orderBy: {
      exactDate: 'asc'
    }
  });

  // Filter for August 2026 and EXCLUDE IRRELEVANT
  const augustTicketsWithoutIrrelevant = allTickets.filter(t => {
    const d = new Date(t.exactDate);
    const isAugust = d.getFullYear() === 2026 && d.getMonth() === 7;
    const isNotIrrelevant = t.status !== 'IRRELEVANT';
    return isAugust && isNotIrrelevant;
  });

  const batchConfigs = [
    {
      batchKey: 'Ali Shehzad (Batch 1)',
      employeeName: 'Ali Shehzad',
      batchLabel: 'Batch 1',
      originalAliases: 'Rizwan Hussain, Ali Shezad',
      accentColor: '#0284c7',
      filenamePrefix: 'Batch_1_Ali_Shehzad'
    },
    {
      batchKey: 'Muhammad Ibrahim (Batch 2)',
      employeeName: 'Muhammad Ibrahim',
      batchLabel: 'Batch 2',
      originalAliases: 'Muhammad Ibrahim, Ibrahim',
      accentColor: '#10b981',
      filenamePrefix: 'Batch_2_Muhammad_Ibrahim'
    },
    {
      batchKey: 'Shah Zaib (Batch 3)',
      employeeName: 'Shah Zaib',
      batchLabel: 'Batch 3',
      originalAliases: 'Shahzaib, Shah Zaib',
      accentColor: '#8b5cf6',
      filenamePrefix: 'Batch_3_Shah_Zaib'
    },
    {
      batchKey: 'Sarmad Islam (Batch 4)',
      employeeName: 'Sarmad Islam',
      batchLabel: 'Batch 4',
      originalAliases: 'Sarmad Islam, Sermad Islam',
      accentColor: '#f59e0b',
      filenamePrefix: 'Batch_4_Sarmad_Islam'
    }
  ];

  const groupedTickets = {
    'Ali Shehzad (Batch 1)': [],
    'Muhammad Ibrahim (Batch 2)': [],
    'Shah Zaib (Batch 3)': [],
    'Sarmad Islam (Batch 4)': [],
    'Other / Unassigned': []
  };

  augustTicketsWithoutIrrelevant.forEach(t => {
    const rawEmp = getTicketEntryPerson(t);
    const mapped = mapEmployeeBatchName(rawEmp);
    if (groupedTickets[mapped]) {
      groupedTickets[mapped].push(t);
    } else {
      groupedTickets['Other / Unassigned'].push(t);
    }
  });

  const baseDir = 'c:/Users/SL LAPTOP/Desktop/accounts management';

  // 1. Generate individual reports for each batch
  for (const cfg of batchConfigs) {
    const tickets = groupedTickets[cfg.batchKey] || [];
    const intakeCount = tickets.filter(t => t.jobMetadata).length;
    const cancelledCount = tickets.filter(t => t.status === 'CANCELLED').length;
    const pendingCount = tickets.filter(t => !t.jobMetadata && t.status !== 'CANCELLED').length;
    const intakeRate = tickets.length > 0 ? Math.round((intakeCount / tickets.length) * 100) : 0;

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${cfg.employeeName} (${cfg.batchLabel}) - August 2026 Complaints Report</title>
  <style>
    ${getBaseCss(cfg.accentColor)}
  </style>
</head>
<body>
  <div class="report-header">
    <div>
      <div style="font-size: 8pt; color: ${cfg.accentColor}; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
        NEXUS OPERATIONS — INDIVIDUAL EMPLOYEE AUDIT
      </div>
      <div class="report-title">
        ${cfg.employeeName} <span class="batch-badge">${cfg.batchLabel}</span>
      </div>
      <div class="report-subtitle">
        Tenure: <strong>August 1, 2026 – August 31, 2026</strong> &bull; System Names: <em>${cfg.originalAliases}</em> &bull; Filter: <strong>Excluding Irrelevant Complaints</strong>
      </div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 14pt; font-weight: 800; color: ${cfg.accentColor};">${tickets.length} Complaints</div>
      <div style="font-size: 7.5pt; color: #64748b;">Generated on ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-label">Total Valid Complaints</div>
      <div class="summary-count">${tickets.length}</div>
      <div class="summary-subtext">All relevant tasks processed</div>
    </div>
    <div class="summary-card" style="border-top-color: #10b981;">
      <div class="summary-label">Intake Done (Converted)</div>
      <div class="summary-count" style="color: #10b981;">${intakeCount}</div>
      <div class="summary-subtext">${intakeRate}% Conversion rate</div>
    </div>
    <div class="summary-card" style="border-top-color: #ef4444;">
      <div class="summary-label">Cancelled</div>
      <div class="summary-count" style="color: #ef4444;">${cancelledCount}</div>
      <div class="summary-subtext">Cancelled or voided</div>
    </div>
    <div class="summary-card" style="border-top-color: #64748b;">
      <div class="summary-label">Pending / In-Progress</div>
      <div class="summary-count" style="color: #64748b;">${pendingCount}</div>
      <div class="summary-subtext">Awaiting next steps</div>
    </div>
  </div>

  <div class="section-header">
    <span>Detailed Complaints Breakdown (${tickets.length} Records)</span>
    <span style="font-size: 8pt; font-weight: 500;">August 2026 &bull; Sorted chronologically</span>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 85px;">Serial #</th>
        <th style="width: 105px;">Date &amp; Time</th>
        <th style="width: 190px;">Client &amp; Branch / Nature</th>
        <th style="width: 160px;">Sender</th>
        <th>Subject &amp; Details</th>
        <th style="width: 105px; text-align: center;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${renderTableRows(tickets, cfg.accentColor)}
    </tbody>
  </table>
</body>
</html>`;

    const htmlPath = path.join(baseDir, `${cfg.filenamePrefix}_August_2026_Complaints.html`);
    const pdfPath = path.join(baseDir, `${cfg.filenamePrefix}_August_2026_Complaints.pdf`);

    fs.writeFileSync(htmlPath, htmlContent, 'utf8');
    console.log(`Generated HTML: ${htmlPath}`);

    try {
      convertHtmlToPdf(htmlPath, pdfPath);
      console.log(`✓ Generated PDF: ${pdfPath}`);
    } catch (err) {
      console.error(`Failed to convert ${htmlPath} to PDF:`, err);
    }
  }

  // 2. Generate Consolidated All-Employees Report without Irrelevant
  const totalRelevant = augustTicketsWithoutIrrelevant.length;
  let combinedHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>August 2026 Employee Complaints Audit Report (Without Irrelevant)</title>
  <style>
    ${getBaseCss('#4f46e5')}
  </style>
</head>
<body>
  <div class="report-header">
    <div>
      <div style="font-size: 8pt; color: #4f46e5; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
        NEXUS OPERATIONS &bull; MONTHLY PERFORMANCE AUDIT
      </div>
      <div class="report-title">
        August 2026 Complaints &amp; Workload Audit Report
      </div>
      <div class="report-subtitle">
        Tenure: <strong>August 1, 2026 – August 31, 2026</strong> &bull; Filter: <strong>Excluding Irrelevant Complaints</strong> &bull; Total Valid Records: <strong>${totalRelevant}</strong>
      </div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 14pt; font-weight: 800; color: #4f46e5;">${totalRelevant} Complaints</div>
      <div style="font-size: 7.5pt; color: #64748b;">Generated on ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
    </div>
  </div>

  <div class="summary-grid" style="grid-template-columns: repeat(5, 1fr);">
    <div class="summary-card" style="border-top-color: #0284c7;">
      <div class="summary-label">Ali Shehzad (Batch 1)</div>
      <div class="summary-count" style="color: #0284c7;">${groupedTickets['Ali Shehzad (Batch 1)'].length}</div>
      <div class="summary-subtext">${groupedTickets['Ali Shehzad (Batch 1)'].filter(t => t.jobMetadata).length} Intakes Done</div>
    </div>
    <div class="summary-card" style="border-top-color: #10b981;">
      <div class="summary-label">M. Ibrahim (Batch 2)</div>
      <div class="summary-count" style="color: #10b981;">${groupedTickets['Muhammad Ibrahim (Batch 2)'].length}</div>
      <div class="summary-subtext">${groupedTickets['Muhammad Ibrahim (Batch 2)'].filter(t => t.jobMetadata).length} Intakes Done</div>
    </div>
    <div class="summary-card" style="border-top-color: #8b5cf6;">
      <div class="summary-label">Shah Zaib (Batch 3)</div>
      <div class="summary-count" style="color: #8b5cf6;">${groupedTickets['Shah Zaib (Batch 3)'].length}</div>
      <div class="summary-subtext">${groupedTickets['Shah Zaib (Batch 3)'].filter(t => t.jobMetadata).length} Intakes Done</div>
    </div>
    <div class="summary-card" style="border-top-color: #f59e0b;">
      <div class="summary-label">Sarmad Islam (Batch 4)</div>
      <div class="summary-count" style="color: #f59e0b;">${groupedTickets['Sarmad Islam (Batch 4)'].length}</div>
      <div class="summary-subtext">${groupedTickets['Sarmad Islam (Batch 4)'].filter(t => t.jobMetadata).length} Intakes Done</div>
    </div>
    <div class="summary-card" style="border-top-color: #64748b;">
      <div class="summary-label">Other / Auto-Ingested</div>
      <div class="summary-count" style="color: #64748b;">${groupedTickets['Other / Unassigned'].length}</div>
      <div class="summary-subtext">Unassigned intake / pending</div>
    </div>
  </div>
`;

  // Append each batch section
  for (const cfg of batchConfigs) {
    const tickets = groupedTickets[cfg.batchKey] || [];
    combinedHtml += `
      <div class="section-header" style="background: ${cfg.accentColor}; margin-top: 24px;">
        <span>${cfg.employeeName} (${cfg.batchLabel}) &mdash; ${tickets.length} Complaints</span>
        <span style="font-size: 8pt; font-weight: 500;">Original aliases: ${cfg.originalAliases}</span>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 85px;">Serial #</th>
            <th style="width: 105px;">Date &amp; Time</th>
            <th style="width: 190px;">Client &amp; Branch / Nature</th>
            <th style="width: 160px;">Sender</th>
            <th>Subject &amp; Details</th>
            <th style="width: 105px; text-align: center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${renderTableRows(tickets, cfg.accentColor)}
        </tbody>
      </table>
    `;
  }

  // Also include Other / Unassigned if any
  const otherTickets = groupedTickets['Other / Unassigned'] || [];
  if (otherTickets.length > 0) {
    combinedHtml += `
      <div class="section-header" style="background: #475569; margin-top: 24px;">
        <span>Other / Unassigned &mdash; ${otherTickets.length} Complaints</span>
        <span style="font-size: 8pt; font-weight: 500;">Auto-ingested emails</span>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 85px;">Serial #</th>
            <th style="width: 105px;">Date &amp; Time</th>
            <th style="width: 190px;">Client &amp; Branch / Nature</th>
            <th style="width: 160px;">Sender</th>
            <th>Subject &amp; Details</th>
            <th style="width: 105px; text-align: center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${renderTableRows(otherTickets, '#475569')}
        </tbody>
      </table>
    `;
  }

  combinedHtml += `
</body>
</html>`;

  const combinedHtmlPath = path.join(baseDir, 'August_2026_All_Employees_Complaints_Report_Without_Irrelevant.html');
  const combinedPdfPath = path.join(baseDir, 'August_2026_All_Employees_Complaints_Report_Without_Irrelevant.pdf');

  fs.writeFileSync(combinedHtmlPath, combinedHtml, 'utf8');
  console.log(`Generated HTML: ${combinedHtmlPath}`);

  try {
    convertHtmlToPdf(combinedHtmlPath, combinedPdfPath);
    console.log(`✓ Generated Combined PDF: ${combinedPdfPath}`);
  } catch (err) {
    console.error(`Failed to convert combined report to PDF:`, err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
