const { PrismaClient } = require('../src/generated/client/index.js');
const fs = require('fs');
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
    return '<span class="badge badge-green">Intake Done</span>';
  }
  if (ticket.status === 'RELEVANT') {
    return '<span class="badge badge-blue">Relevant</span>';
  }
  if (ticket.status === 'IRRELEVANT') {
    return '<span class="badge badge-yellow">Irrelevant</span>';
  }
  if (ticket.status === 'CANCELLED') {
    return '<span class="badge badge-red">Cancelled</span>';
  }
  return '<span class="badge badge-gray">Pending</span>';
}

async function generateReport() {
  console.log('Fetching August 2026 data...');
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

  const augustTickets = allTickets.filter(t => {
    const d = new Date(t.exactDate);
    return d.getFullYear() === 2026 && d.getMonth() === 7;
  });

  const batches = {
    'Ali Shehzad (Batch 1)': [],
    'Muhammad Ibrahim (Batch 2)': [],
    'Shah Zaib (Batch 3)': [],
    'Sarmad Islam (Batch 4)': [],
    'Unassigned / Auto-Ingested': []
  };

  augustTickets.forEach(t => {
    const rawEmp = getTicketEntryPerson(t);
    const mapped = mapEmployeeBatchName(rawEmp);
    if (batches[mapped]) {
      batches[mapped].push(t);
    } else {
      batches['Unassigned / Auto-Ingested'].push(t);
    }
  });

  const totalComplaints = augustTickets.length;

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>August 2026 Complaints & Operations Report</title>
  <style>
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
        content: "NEXUS Operations — August 2026 Employee Complaints Audit";
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
      font-size: 20pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
    }

    .report-subtitle {
      font-size: 10pt;
      color: #64748b;
      margin-top: 2px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
      margin-bottom: 20px;
      page-break-inside: avoid;
    }

    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      border-top: 4px solid #4f46e5;
    }

    .card-batch-1 { border-top-color: #3b82f6; }
    .card-batch-2 { border-top-color: #10b981; }
    .card-batch-3 { border-top-color: #8b5cf6; }
    .card-batch-4 { border-top-color: #f59e0b; }
    .card-batch-5 { border-top-color: #64748b; }

    .summary-name {
      font-size: 8.5pt;
      font-weight: 700;
      color: #334155;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .summary-count {
      font-size: 18pt;
      font-weight: 800;
      color: #0f172a;
      line-height: 1;
    }

    .summary-meta {
      font-size: 7.5pt;
      color: #64748b;
      margin-top: 4px;
    }

    .section-banner {
      background: #0f172a;
      color: #ffffff;
      padding: 8px 12px;
      border-radius: 6px;
      margin-top: 20px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      page-break-after: avoid;
    }

    .section-title {
      font-size: 11pt;
      font-weight: 700;
      letter-spacing: 0.2px;
    }

    .section-badge {
      background: rgba(255, 255, 255, 0.15);
      color: #38bdf8;
      font-size: 8pt;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 4px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
      margin-bottom: 16px;
      page-break-inside: auto;
    }

    tr { page-break-inside: avoid; page-break-after: auto; }
    thead { display: table-header-group; }

    th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      text-align: left;
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    td {
      padding: 5px 8px;
      border: 1px solid #e2e8f0;
      vertical-align: top;
      color: #334155;
    }

    tr:nth-child(even) td {
      background: #f8fafc;
    }

    .serial-col {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      color: #0284c7;
      width: 65px;
      white-space: nowrap;
    }

    .date-col {
      width: 105px;
      white-space: nowrap;
      font-size: 7.5pt;
    }

    .client-col {
      width: 180px;
      font-size: 7.5pt;
    }

    .sender-col {
      width: 170px;
      word-break: break-word;
      font-size: 7.5pt;
      color: #475569;
    }

    .subject-col {
      word-break: break-word;
    }

    .status-col {
      width: 95px;
      text-align: center;
      white-space: nowrap;
    }

    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 8px;
      font-size: 6.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .badge-green { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
    .badge-blue { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
    .badge-yellow { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
    .badge-red { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
    .badge-gray { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }

    .page-break { page-break-after: always; }
  </style>
</head>
<body>

  <!-- HEADER -->
  <div class="report-header">
    <div>
      <div class="report-title">AUGUST 2026 COMPLAINTS &amp; OPERATIONS AUDIT</div>
      <div class="report-subtitle">FES Fast Engineering Solutions &mdash; NEXUS Operations Management System</div>
    </div>
    <div style="text-align: right; font-size: 8pt; color: #64748b;">
      <div><strong>Total August Complaints:</strong> ${totalComplaints} Records</div>
      <div><strong>Reporting Period:</strong> Aug 1, 2026 &ndash; Aug 31, 2026</div>
      <div><strong>Generated:</strong> ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
    </div>
  </div>

  <!-- SUMMARY CARDS -->
  <div class="summary-grid">
    <div class="summary-card card-batch-1">
      <div class="summary-name">Ali Shehzad (Batch 1)</div>
      <div class="summary-count">${batches['Ali Shehzad (Batch 1)'].length}</div>
      <div class="summary-meta">${batches['Ali Shehzad (Batch 1)'].filter(t => t.jobMetadata).length} Intake Done | ${batches['Ali Shehzad (Batch 1)'].filter(t => t.status === 'IRRELEVANT').length} Irrelevant</div>
    </div>
    <div class="summary-card card-batch-2">
      <div class="summary-name">Muhammad Ibrahim (Batch 2)</div>
      <div class="summary-count">${batches['Muhammad Ibrahim (Batch 2)'].length}</div>
      <div class="summary-meta">${batches['Muhammad Ibrahim (Batch 2)'].filter(t => t.jobMetadata).length} Intake Done | ${batches['Muhammad Ibrahim (Batch 2)'].filter(t => t.status === 'IRRELEVANT').length} Irrelevant</div>
    </div>
    <div class="summary-card card-batch-3">
      <div class="summary-name">Shah Zaib (Batch 3)</div>
      <div class="summary-count">${batches['Shah Zaib (Batch 3)'].length}</div>
      <div class="summary-meta">${batches['Shah Zaib (Batch 3)'].filter(t => t.jobMetadata).length} Intake Done | ${batches['Shah Zaib (Batch 3)'].filter(t => t.status === 'IRRELEVANT').length} Irrelevant</div>
    </div>
    <div class="summary-card card-batch-4">
      <div class="summary-name">Sarmad Islam (Batch 4)</div>
      <div class="summary-count">${batches['Sarmad Islam (Batch 4)'].length}</div>
      <div class="summary-meta">${batches['Sarmad Islam (Batch 4)'].filter(t => t.jobMetadata).length} Intake Done | ${batches['Sarmad Islam (Batch 4)'].filter(t => t.status === 'IRRELEVANT').length} Irrelevant</div>
    </div>
    <div class="summary-card card-batch-5">
      <div class="summary-name">Unassigned / Auto-Ingested</div>
      <div class="summary-count">${batches['Unassigned / Auto-Ingested'].length}</div>
      <div class="summary-meta">${batches['Unassigned / Auto-Ingested'].filter(t => t.jobMetadata).length} Intake Done | ${batches['Unassigned / Auto-Ingested'].filter(t => t.status === 'PENDING').length} Pending</div>
    </div>
  </div>
`;

  const batchOrder = [
    'Ali Shehzad (Batch 1)',
    'Muhammad Ibrahim (Batch 2)',
    'Shah Zaib (Batch 3)',
    'Sarmad Islam (Batch 4)',
    'Unassigned / Auto-Ingested'
  ];

  for (const batchName of batchOrder) {
    const list = batches[batchName] || [];
    const intakeCount = list.filter(t => t.jobMetadata).length;
    const irrelevantCount = list.filter(t => t.status === 'IRRELEVANT').length;
    const cancelledCount = list.filter(t => t.status === 'CANCELLED').length;
    const pendingCount = list.filter(t => !t.jobMetadata && t.status === 'PENDING').length;

    html += `
    <div class="section-banner">
      <div class="section-title">${escapeHtml(batchName)} &mdash; Total ${list.length} Complaints</div>
      <div class="section-badge">${intakeCount} Intake Done &bull; ${irrelevantCount} Irrelevant ${cancelledCount > 0 ? `&bull; ${cancelledCount} Cancelled ` : ''}${pendingCount > 0 ? `&bull; ${pendingCount} Pending` : ''}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="serial-col">Serial #</th>
          <th class="date-col">Date &amp; Time</th>
          <th class="client-col">Client &amp; Branch / Nature</th>
          <th class="sender-col">Sender / From</th>
          <th class="subject-col">Subject / Work Description</th>
          <th class="status-col">Status</th>
        </tr>
      </thead>
      <tbody>
    `;

    if (list.length === 0) {
      html += `<tr><td colspan="6" style="text-align:center; padding: 12px; color: #94a3b8;">No complaints recorded for this employee in August 2026.</td></tr>`;
    } else {
      list.forEach(t => {
        let clientBranch = '—';
        if (t.jobMetadata) {
          clientBranch = `<strong>${escapeHtml(t.jobMetadata.clientName || '')}</strong><br><span style="color:#64748b;">${escapeHtml(t.jobMetadata.branchName || '')}</span>`;
          if (t.jobMetadata.workNature) {
            clientBranch += `<br><span style="color:#0284c7; font-size: 7pt; font-weight:600;">${escapeHtml(t.jobMetadata.workNature)}</span>`;
          }
        }

        html += `
        <tr>
          <td class="serial-col">${escapeHtml(t.serialNo || t.id)}</td>
          <td class="date-col">
            ${formatDate(t.exactDate)}<br>
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
      });
    }

    html += `
      </tbody>
    </table>
    `;
  }

  html += `
</body>
</html>
`;

  fs.writeFileSync('c:/Users/SL LAPTOP/Desktop/accounts management/August_2026_Complaints_Report.html', html, 'utf8');
  console.log('HTML generated successfully at August_2026_Complaints_Report.html');
}

generateReport()
  .catch(console.error)
  .finally(() => prisma.$disconnect());