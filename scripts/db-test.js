const { PrismaClient } = require('../src/generated/client/index.js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^\s*DATABASE_URL="?([^"\n]+)"?/);
  if (m) process.env.DATABASE_URL = m[1];
}
(async () => {
  const prisma = new PrismaClient();
  try {
    const n = await prisma.jobMetadata.count();
    console.log('jobMetadata count:', n);
    const jobs = await prisma.jobMetadata.findMany({
      take: 1,
      include: {
        ticket: true, createdBy: true, assignedEmployee: true,
        surveyReport: true, quotationInvoices: true, expenses: true,
        payments: true, workCompletion: true, bankApproval: true,
      },
    });
    console.log('sample job keys:', jobs[0] ? Object.keys(jobs[0]) : 'none');
    console.log('OK');
  } catch (e) {
    console.error('QUERY ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
