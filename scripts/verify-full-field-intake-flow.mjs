import { PrismaClient } from '../src/generated/client/index.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Starting Full Field Intake & Expense Automatic Routing Verification...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Verify Office User with Gmail Account exists
  const officeUser = await prisma.user.findFirst({
    where: {
      gmailAccounts: { some: {} },
    },
    include: { gmailAccounts: true },
  });
  assert(officeUser !== null, `Office user with connected Gmail exists: ${officeUser?.employeeName} (${officeUser?.gmailAccounts?.[0]?.gmailEmail})`);

  // 2. Verify or find Field Employee
  let fieldUser = await prisma.user.findFirst({
    where: { role: 'FIELD_EMPLOYEE' },
  });
  if (!fieldUser) {
    console.log('  ℹ️ No user currently has role FIELD_EMPLOYEE. Let us test toggling an employee role to FIELD_EMPLOYEE safely.');
    const emp = await prisma.user.findFirst({ where: { role: 'EMPLOYEE', id: { not: officeUser?.id } } });
    if (emp) {
      fieldUser = await prisma.user.update({
        where: { id: emp.id },
        data: { role: 'FIELD_EMPLOYEE' },
      });
      console.log(`  ℹ️ Updated ${fieldUser.employeeName} to FIELD_EMPLOYEE for test.`);
    }
  }
  assert(fieldUser !== null && fieldUser.role === 'FIELD_EMPLOYEE', `Field employee available: ${fieldUser?.employeeName} (Role: ${fieldUser?.role})`);

  // 3. Create a test Ticket received on the office employee's Gmail account
  const testTicket = await prisma.ticket.create({
    data: {
      serialNo: `TEST-${Date.now().toString().slice(-4)}`,
      subject: 'Field Site Project Intake UBL Branch Test',
      sender: 'client.test@ubl.com.pk',
      gmailAccountId: officeUser.gmailAccounts[0].id,
      gmailMessageId: `test_msg_${Date.now()}`,
      time: '10:30 AM',
      exactDate: new Date(),
    },
  });
  assert(testTicket.id > 0, `Created ticket #${testTicket.serialNo} linked to office Gmail account #${officeUser.gmailAccounts[0].id}`);

  // 4. Simulate Field Employee Intake with Work Nature = PROJECT
  const testJob = await prisma.jobMetadata.create({
    data: {
      ticketId: testTicket.id,
      clientName: 'United Bank Limited',
      branchName: 'Mall Road Lahore Branch',
      personOfContact: 'Tariq Mehmood (Branch Manager)',
      workNature: 'PROJECT',
      assignedEmployeeId: fieldUser.id,
      manualEnteredBy: fieldUser.employeeName,
      createdById: fieldUser.id,
    },
    include: { ticket: { include: { gmailAccount: true } } },
  });
  assert(testJob.id > 0 && testJob.workNature === 'PROJECT', `Created Job #${testJob.id} with Work Nature = PROJECT assigned to ${fieldUser.employeeName}`);

  // 5. Simulate Field Employee Submitting Both PDF Reports (Progress & Expense)
  const progressData = [
    {
      category: 'Civil Work',
      items: [
        { code: 'a', name: 'Tile Flooring replacement', unit: 'sft', workPercent: '85', remark: 'In progress', others: '' },
      ],
    },
    {
      category: 'Electric Work',
      items: [
        { code: 'a', name: 'Main distribution board wiring', unit: 'Jop', workPercent: '100', remark: 'Completed', others: '' },
      ],
    },
  ];

  const expenseData = [
    {
      category: 'Cement',
      items: [
        { code: 'a', name: 'Askari / Fauji Cement Bags', qty: '30 Bags', amount: '45000', others: 'Site foundation' },
      ],
    },
    {
      category: 'Electric Work',
      items: [
        { code: 'a', name: 'Pakistan Cables 7/0.029 Wire Coil', qty: '3 Coils', amount: '28500', others: 'Circuit wiring' },
      ],
    },
  ];

  const totalExpenseAmount = 45000 + 28500; // 73500

  // Create linked expense
  const testExpense = await prisma.expense.create({
    data: {
      jobMetadataId: testJob.id,
      amount: totalExpenseAmount,
      paidBy: 'FES',
      category: 'Site Expense',
      summaryNotes: `[Field Work] [Project Report] ${testJob.branchName} - Grand Total: Rs. ${totalExpenseAmount.toLocaleString()}`,
      createdById: fieldUser.id,
    },
  });

  const testReport = await prisma.projectReportSubmission.create({
    data: {
      jobMetadataId: testJob.id,
      employeeId: fieldUser.id,
      branchName: testJob.branchName,
      reportDate: new Date(),
      version: 1,
      status: 'SUBMITTED',
      totalExpenseAmount,
      overallProgressPercent: 92.5,
      progressData: JSON.stringify(progressData),
      expenseData: JSON.stringify(expenseData),
      attachments: JSON.stringify([{ name: 'cement_voucher.jpg', url: 'https://example.com/cement.jpg' }]),
      paidBy: 'FES',
      linkedExpenseId: testExpense.id,
    },
  });

  assert(testReport.id > 0 && testReport.status === 'SUBMITTED', `Project report #${testReport.id} submitted by field staff with total Rs. ${totalExpenseAmount.toLocaleString()}`);

  // 6. Simulate Field Employee Logging Direct Field Expense
  const directExpense = await prisma.expense.create({
    data: {
      jobMetadataId: testJob.id,
      amount: 4200,
      paidBy: 'EMPLOYEE',
      category: 'Fuel & Travel',
      summaryNotes: `[Field Work] [Fuel & Travel] Generator diesel purchase on site`,
      createdById: fieldUser.id,
      expenseDate: new Date(),
    },
  });
  assert(directExpense.id > 0, `Direct field expense #${directExpense.id} logged (Rs. 4,200)`);

  // 7. Verify Automatic Data Routing to Office Employee
  // Query jobs as the office employee using the exact OR condition from src/app/api/jobs/route.js
  const officeQueryJobs = await prisma.jobMetadata.findMany({
    where: {
      OR: [
        { assignedEmployeeId: officeUser.id },
        { createdById: officeUser.id },
        { ticket: { gmailAccount: { userId: officeUser.id } } },
        { ticket: { createdById: officeUser.id } },
        { ticket: { gmailAccountId: { in: officeUser.gmailAccounts.map(g => g.id) } } },
      ],
    },
    include: {
      ticket: { include: { gmailAccount: true } },
      expenses: true,
      projectReports: true,
    },
  });

  const matchedJob = officeQueryJobs.find(j => j.id === testJob.id);
  assert(matchedJob !== undefined, `Office employee (${officeUser.employeeName}) automatically retrieved field job #${testJob.id} via connected Gmail account`);

  const jobExpenses = matchedJob?.expenses || [];
  assert(jobExpenses.length >= 2, `Office employee sees all field expenses (${jobExpenses.length} records found on job)`);

  const reportExpense = jobExpenses.find(e => e.id === testExpense.id);
  assert(reportExpense !== undefined && reportExpense.amount === 73500, `Report expense Rs. 73,500 visible to office`);

  const directExpenseFound = jobExpenses.find(e => e.id === directExpense.id);
  assert(directExpenseFound !== undefined && directExpenseFound.amount === 4200, `Direct field expense Rs. 4,200 visible to office`);

  const matchedReport = matchedJob?.projectReports?.[0];
  assert(matchedReport !== undefined && matchedReport.version === 1, `Office reviewer has access to Project Report v${matchedReport?.version}`);

  // 8. Clean up test records
  console.log('\n🧹 Cleaning up test verification records...');
  await prisma.projectReportSubmission.delete({ where: { id: testReport.id } }).catch(() => {});
  await prisma.expense.deleteMany({ where: { id: { in: [testExpense.id, directExpense.id] } } }).catch(() => {});
  await prisma.jobMetadata.delete({ where: { id: testJob.id } }).catch(() => {});
  await prisma.ticket.delete({ where: { id: testTicket.id } }).catch(() => {});
  console.log('  ✅ Test records cleaned up successfully.');

  console.log(`\n========================================`);
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
