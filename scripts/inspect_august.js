const { PrismaClient } = require('../src/generated/client/index.js');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.cheqzrvucqlrdtlvfirk:anie%401234%231234@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
    }
  }
});

async function main() {
  const users = await prisma.user.findMany();
  console.log('All users in DB:', JSON.stringify(users.map(u => ({ id: u.id, name: u.employeeName, role: u.role, email: u.email })), null, 2));

  // Fetch all tickets in August 2026
  // Exact date range: 2026-08-01 to 2026-08-31
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

  console.log('Total tickets in entire database:', allTickets.length);

  // Filter August tickets
  const augustTickets = allTickets.filter(t => {
    const d = new Date(t.exactDate);
    return d.getFullYear() === 2026 && d.getMonth() === 7; // Month 7 is August (0-indexed)
  });

  console.log('August 2026 tickets:', augustTickets.length);

  // Group by employee
  const byEmp = {};
  augustTickets.forEach(t => {
    const emp = t.statusLastChangedBy || t.jobMetadata?.assignedEmployee?.employeeName || t.jobMetadata?.manualEnteredBy || 'Unassigned';
    if (!byEmp[emp]) byEmp[emp] = [];
    byEmp[emp].push({
      id: t.id,
      serialNo: t.serialNo,
      date: t.exactDate,
      time: t.time,
      sender: t.sender,
      subject: t.subject,
      status: t.status,
      statusLastChangedBy: t.statusLastChangedBy,
      assignedEmployee: t.jobMetadata?.assignedEmployee?.employeeName,
      clientName: t.jobMetadata?.clientName,
      branchName: t.jobMetadata?.branchName,
      workNature: t.jobMetadata?.workNature
    });
  });

  console.log('August breakdown by employee keys:', Object.keys(byEmp));
  Object.keys(byEmp).forEach(k => {
    console.log(`Employee/Key: "${k}" -> Count: ${byEmp[k].length}`);
  });

  // Print sample for each employee
  Object.keys(byEmp).forEach(k => {
    console.log(`\nSample for ${k}:`, JSON.stringify(byEmp[k][0], null, 2));
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());