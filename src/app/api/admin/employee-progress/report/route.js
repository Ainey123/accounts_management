import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function getTicketEntryPerson(ticket) {
  return (
    ticket.statusLastChangedBy ||
    ticket.jobMetadata?.assignedEmployee?.employeeName ||
    ticket.jobMetadata?.createdBy?.employeeName ||
    ticket.jobMetadata?.manualEnteredBy ||
    'Unassigned / Auto-Ingested'
  );
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
  if (ticket.status === 'RELEVANT') {
    return '<span class="badge badge-blue">● Relevant</span>';
  }
  if (ticket.status === 'IRRELEVANT') {
    return '<span class="badge badge-yellow">⚠️ Irrelevant</span>';
  }
  if (ticket.status === 'CANCELLED') {
    return '<span class="badge badge-red">✕ Cancelled</span>';
  }
  return '<span class="badge badge-gray">⏳ Pending</span>';
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const monthParam = searchParams.get('month');
    const batchParam = searchParams.get('batch'); // single batch or 'all'
    const excludeIrrelevantParam = searchParams.get('excludeIrrelevant'); // 'true' or 'false'
    const aliasesParam = searchParams.get('aliases'); // JSON encoded aliases map

    const excludeIrrelevant = excludeIrrelevantParam !== 'false';

    let aliasMap = {
      'Rizwan Hussain': 'Ali Shehzad (Batch 1)',
      'Ali Shezad': 'Ali Shehzad (Batch 1)',
      'Ali Shehzad': 'Ali Shehzad (Batch 1)',
      'Ibrahim': 'Muhammad Ibrahim (Batch 2)',
      'Muhammad Ibrahim': 'Muhammad Ibrahim (Batch 2)',
      'Shahzaib': 'Shah Zaib (Batch 3)',
      'Shah Zaib': 'Shah Zaib (Batch 3)',
      'Sermad Islam': 'Sarmad Islam (Batch 4)',
      'Sarmad Islam': 'Sarmad Islam (Batch 4)',
    };

    if (aliasesParam) {
      try {
        const parsed = JSON.parse(aliasesParam);
        aliasMap = { ...aliasMap, ...parsed };
      } catch (e) {
        console.error('Failed to parse custom aliases:', e);
      }
    }

    let startDate;
    let endDate;
    let tenureLabel = 'Custom Period';

    if (fromParam && toParam) {
      startDate = new Date(`${fromParam}T00:00:00.000Z`);
      endDate = new Date(`${toParam}T23:59:59.999Z`);
      tenureLabel = `${fromParam} to ${toParam}`;
    } else if (monthParam) {
      const [yearStr, monthStr] = monthParam.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10) - 1;
      startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
      const monthDate = new Date(year, month, 1);
      tenureLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else {
      const now = new Date();
      startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
      tenureLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    let tickets = await prisma.ticket.findMany({
      where: {
        exactDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        jobMetadata: {
          include: {
            assignedEmployee: true,
            createdBy: true,
          },
        },
        createdBy: true,
      },
      orderBy: {
        exactDate: 'asc',
      },
    });

    // Apply Irrelevant Filter if requested
    if (excludeIrrelevant) {
      tickets = tickets.filter((t) => t.status !== 'IRRELEVANT');
    }

    const getMappedBatch = (rawName) => {
      if (!rawName) return 'Unassigned / Auto-Ingested';
      if (aliasMap[rawName]) return aliasMap[rawName];
      const lower = rawName.toLowerCase().trim();
      for (const [key, val] of Object.entries(aliasMap)) {
        if (key.toLowerCase().trim() === lower) return val;
        if (lower.includes('rizwan') && key.toLowerCase().includes('rizwan')) return val;
        if (lower.includes('ibrahim') && key.toLowerCase().includes('ibrahim')) return val;
        if ((lower.includes('shahzaib') || lower.includes('shah zaib')) && (key.toLowerCase().includes('shahzaib') || key.toLowerCase().includes('shah zaib'))) return val;
        if ((lower.includes('sermad') || lower.includes('sarmad')) && (key.toLowerCase().includes('sermad') || key.toLowerCase().includes('sarmad'))) return val;
      }
      return rawName;
    };

    const batches = {};

    tickets.forEach((t) => {
      const rawPerson = getTicketEntryPerson(t);
      const batchName = getMappedBatch(rawPerson);
      if (!batches[batchName]) {
        batches[batchName] = [];
      }
      batches[batchName].push(t);
    });

    let sortedBatchNames = Object.keys(batches).sort((a, b) => {
      if (a.includes('Batch 1')) return -1;
      if (b.includes('Batch 1')) return 1;
      if (a.includes('Batch 2')) return -1;
      if (b.includes('Batch 2')) return 1;
      if (a.includes('Batch 3')) return -1;
      if (b.includes('Batch 3')) return 1;
      if (a.includes('Batch 4')) return -1;
      if (b.includes('Batch 4')) return 1;
      if (a.includes('Unassigned')) return 1;
      if (b.includes('Unassigned')) return -1;
      return a.localeCompare(b);
    });

    // If a specific batch is targeted, filter to only that batch
    const isSingleBatch = batchParam && batchParam !== 'all';
    if (isSingleBatch) {
      sortedBatchNames = sortedBatchNames.filter((b) => b === batchParam || b.toLowerCase().includes(batchParam.toLowerCase()));
      if (sortedBatchNames.length === 0) {
        sortedBatchNames = [batchParam];
        batches[batchParam] = [];
      }
    }

    const totalValidCount = sortedBatchNames.reduce((acc, b) => acc + (batches[b]?.length || 0), 0);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${isSingleBatch ? escapeHtml(sortedBatchNames[0]) : 'Employee Complaints Audit Report'} - ${escapeHtml(tenureLabel)}</title>
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
        content: "NEXUS Operations — Employee Complaints Progress Audit (${escapeHtml(tenureLabel)})";
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
      margin-top: 2px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
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
      font-size: 10.5pt;
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
      padding: 6px 8px;
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
      width: 75px;
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
      line-height: 1.3;
    }

    .sender-col {
      width: 170px;
      word-break: break-word;
      font-size: 7.5pt;
      color: #475569;
    }

    .subject-col {
      word-break: break-word;
      line-height: 1.35;
    }

    .status-col {
      width: 100px;
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
    .badge-yellow { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
    .badge-red { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
    .badge-gray { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }

    .no-print-bar {
      background: #1e293b;
      color: #ffffff;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    @media print {
      .no-print-bar { display: none !important; }
      body { padding: 0; }
    }
  </style>
</head>
<body>

  <div class="no-print-bar">
    <div>
      <strong>Audit Report Ready:</strong> ${escapeHtml(isSingleBatch ? sortedBatchNames[0] : 'All Batches')} &bull; Tenure: ${escapeHtml(tenureLabel)} &bull; <strong>${totalValidCount} Complaints</strong> (${excludeIrrelevant ? 'Excluding Irrelevant' : 'All Included'})
    </div>
    <div style="display: flex; gap: 8px;">
      <button onclick="window.print()" style="background: #4f46e5; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;">
        🖨️ Print / Save as PDF
      </button>
    </div>
  </div>

  <div class="report-header">
    <div>
      <div style="font-size: 8pt; color: #4f46e5; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
        NEXUS OPERATIONS &bull; EMPLOYEE COMPLAINTS AUDIT
      </div>
      <div class="report-title">
        ${isSingleBatch ? `${escapeHtml(sortedBatchNames[0])} Complaints Audit` : 'MONTHLY EMPLOYEE COMPLAINTS REPORT'}
      </div>
      <div class="report-subtitle">
        Tenure: <strong>${escapeHtml(tenureLabel)}</strong> &bull; Filter: <strong>${excludeIrrelevant ? 'Excluding Irrelevant Complaints (Valid Workload Only)' : 'All Ingested Complaints Included'}</strong>
      </div>
    </div>
    <div style="text-align: right; font-size: 8pt; color: #64748b;">
      <div><strong style="color: #0f172a; font-size: 11pt;">${totalValidCount} Valid Records</strong></div>
      <div><strong>Date Range:</strong> ${formatDate(startDate)} &ndash; ${formatDate(endDate)}</div>
      <div><strong>Generated:</strong> ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
    </div>
  </div>

  <div class="summary-grid">
    ${sortedBatchNames
      .map((batchName) => {
        const list = batches[batchName] || [];
        const intakeCount = list.filter((t) => t.jobMetadata).length;
        const cancelledCount = list.filter((t) => t.status === 'CANCELLED').length;
        const pendingCount = list.filter((t) => !t.jobMetadata && t.status === 'PENDING').length;
        const intakeRate = list.length > 0 ? Math.round((intakeCount / list.length) * 100) : 0;
        
        let borderCol = '#4f46e5';
        if (batchName.includes('Batch 1')) borderCol = '#0284c7';
        else if (batchName.includes('Batch 2')) borderCol = '#10b981';
        else if (batchName.includes('Batch 3')) borderCol = '#8b5cf6';
        else if (batchName.includes('Batch 4')) borderCol = '#f59e0b';

        return `
        <div class="summary-card" style="border-top-color: ${borderCol};">
          <div class="summary-name">${escapeHtml(batchName)}</div>
          <div class="summary-count">${list.length}</div>
          <div class="summary-meta">${intakeCount} Intake Done (${intakeRate}%) ${cancelledCount > 0 ? `| ${cancelledCount} Cancelled` : ''} ${pendingCount > 0 ? `| ${pendingCount} Pending` : ''}</div>
        </div>
        `;
      })
      .join('')}
  </div>

  ${sortedBatchNames
    .map((batchName) => {
      const list = batches[batchName] || [];
      const intakeCount = list.filter((t) => t.jobMetadata).length;
      const cancelledCount = list.filter((t) => t.status === 'CANCELLED').length;
      const pendingCount = list.filter((t) => !t.jobMetadata && t.status === 'PENDING').length;

      let bannerBg = '#0f172a';
      if (batchName.includes('Batch 1')) bannerBg = '#0284c7';
      else if (batchName.includes('Batch 2')) bannerBg = '#059669';
      else if (batchName.includes('Batch 3')) bannerBg = '#7c3aed';
      else if (batchName.includes('Batch 4')) bannerBg = '#d97706';

      return `
      <div class="section-banner" style="background: ${bannerBg};">
        <div class="section-title">${escapeHtml(batchName)} &mdash; Total ${list.length} Complaints</div>
        <div class="section-badge">${intakeCount} Intake Done ${cancelledCount > 0 ? `&bull; ${cancelledCount} Cancelled ` : ''}${pendingCount > 0 ? `&bull; ${pendingCount} Pending` : ''}</div>
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
          ${
            list.length === 0
              ? `<tr><td colspan="6" style="text-align:center; padding: 14px; color: #94a3b8;">No valid complaints recorded for this employee in the selected tenure.</td></tr>`
              : list
                  .map((t) => {
                    let clientBranch = '—';
                    if (t.jobMetadata) {
                      clientBranch = `<strong>${escapeHtml(t.jobMetadata.clientName || '')}</strong><br><span style="color:#64748b;">${escapeHtml(t.jobMetadata.branchName || '')}</span>`;
                      if (t.jobMetadata.workNature) {
                        clientBranch += `<br><span style="color:#0284c7; font-size: 7pt; font-weight:600;">${escapeHtml(t.jobMetadata.workNature)}</span>`;
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
                  })
                  .join('')
          }
        </tbody>
      </table>
      `;
    })
    .join('')}

</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error generating employee report:', error);
    return new NextResponse(`Error: ${error.message}`, { status: 500 });
  }
}
