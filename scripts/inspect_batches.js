const { PrismaClient } = require('../src/generated/client/index.js');
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
  return name;
}

async function main() {
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
    'Other / Unassigned': []
  };

  augustTickets.forEach(t => {
    const rawEmp = getTicketEntryPerson(t);
    const mapped = mapEmployeeBatchName(rawEmp);
    if (batches[mapped]) {
      batches[mapped].push(t);
    } else {
      batches['Other / Unassigned'].push(t);
    }
  });

  console.log('--- AUGUST 2026 COMPLAINTS SUMMARY ---');
  Object.keys(batches).forEach(b => {
    console.log(`${b}: ${batches[b].length} tickets`);
  });

  // Check breakdown of status for each batch
  Object.keys(batches).forEach(b => {
    const statuses = {};
    batches[b].forEach(t => {
      let st = t.status || 'PENDING';
      if (t.jobMetadata) st = 'INTAKE_DONE';
      statuses[st] = (statuses[st] || 0) + 1;
    });
    console.log(`Status breakdown for ${b}:`, JSON.stringify(statuses));
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());