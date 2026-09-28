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

function formatDate(dateVal) {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function run() {
  const allTickets = await prisma.ticket.findMany({
    include: {
      jobMetadata: { include: { assignedEmployee: true, createdBy: true } },
      createdBy: true
    },
    orderBy: { exactDate: 'asc' }
  });

  const augustTickets = allTickets.filter(t => {
    const d = new Date(t.exactDate);
    return d.getFullYear() === 2026 && d.getMonth() === 7 && t.status !== 'IRRELEVANT';
  });

  const batches = {
    'Ali Shehzad (Batch 1)': [],
    'Muhammad Ibrahim (Batch 2)': [],
    'Shah Zaib (Batch 3)': [],
    'Sarmad Islam (Batch 4)': [],
    'Other / Unassigned': []
  };

  augustTickets.forEach(t => {
    const rawEmp = getTicketEntryPerson(t);
    const mapped = mapEmployeeBatchName(rawEmp);
    if (batches[mapped]) batches[mapped].push(t);
    else batches['Other / Unassigned'].push(t);
  });

  let md = '# August 2026 Individual Employee Complaints Report (Excluding Irrelevant)\n\n';
  md += '> [!NOTE]\n';
  md += '> **Audit Summary**: This report details all valid and processed complaints for the month of **August 2026** categorized individually by employee batch. All filtered/irrelevant complaints have been completely excluded.\n\n';
  md += '## 📊 Monthly Executive Summary\n\n';
  md += '| Employee & Batch | Total Valid Complaints | Intake Done | Cancelled | Pending | Conversion Rate |\n';
  md += '| :--- | :---: | :---: | :---: | :---: | :---: |\n';

  const configs = [
    { key: 'Ali Shehzad (Batch 1)', name: 'Ali Shehzad', batch: 'Batch 1' },
    { key: 'Muhammad Ibrahim (Batch 2)', name: 'Muhammad Ibrahim', batch: 'Batch 2' },
    { key: 'Shah Zaib (Batch 3)', name: 'Shah Zaib', batch: 'Batch 3' },
    { key: 'Sarmad Islam (Batch 4)', name: 'Sarmad Islam', batch: 'Batch 4' }
  ];

  configs.forEach(c => {
    const list = batches[c.key] || [];
    const intake = list.filter(t => t.jobMetadata).length;
    const cancelled = list.filter(t => t.status === 'CANCELLED').length;
    const pending = list.filter(t => !t.jobMetadata && t.status !== 'CANCELLED').length;
    const rate = list.length > 0 ? Math.round((intake / list.length) * 100) : 0;
    md += `| **${c.name} (${c.batch})** | **${list.length}** | ${intake} | ${cancelled} | ${pending} | **${rate}%** |\n`;
  });

  md += '\n---\n\n';

  configs.forEach(c => {
    const list = batches[c.key] || [];
    md += `## 👤 ${c.name} (${c.batch}) — ${list.length} Valid Complaints\n\n`;
    if (list.length === 0) {
      md += `_No complaints recorded for this employee in August 2026._\n\n`;
      return;
    }

    md += '| Serial # | Date & Time | Client & Branch | Nature of Work | Sender | Status |\n';
    md += '| :--- | :--- | :--- | :--- | :--- | :--- |\n';

    list.forEach(t => {
      const serial = t.serialNo || t.id;
      const dateStr = formatDate(t.exactDate) + (t.time ? ` (${t.time})` : '');
      const client = t.jobMetadata?.clientName || '—';
      const branch = t.jobMetadata?.branchName ? ` (${t.jobMetadata.branchName})` : '';
      const clientBranch = client !== '—' ? client + branch : '—';
      const nature = t.jobMetadata?.workNature || '—';
      const sender = t.sender || '—';
      let st = t.jobMetadata ? '✅ Intake Done' : (t.status === 'CANCELLED' ? '❌ Cancelled' : '⏳ Pending');
      md += `| \`${serial}\` | ${dateStr} | ${clientBranch} | ${nature} | ${sender} | ${st} |\n`;
    });

    md += '\n';
  });

  const outPath = 'C:/Users/SL LAPTOP/.gemini/antigravity/brain/186025d3-8355-4f67-9db5-f8328d8a72f6/august_2026_individual_complaints_no_irrelevant.md';
  fs.writeFileSync(outPath, md, 'utf8');
  console.log('Markdown generated successfully at ' + outPath);
}

run().catch(console.error).finally(() => prisma.$disconnect());
