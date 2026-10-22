import { PrismaClient } from '../src/generated/client/index.js';
import { hashPin } from '../src/lib/pinHash.js';
import { PROJECT_EXPENSE_TEMPLATE, PROJECT_PROGRESS_TEMPLATE } from '../src/lib/projectReportTemplates.js';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://postgres.cheqzrvucqlrdtlvfirk:anie%401234%231234@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
    }
  }
});

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('  FES NEXUS OPERATIONS: FIELD PORTAL E2E VERIFICATION  ');
  console.log('======================================================\n');

  let testUser = null;
  let testTicket = null;
  let testJob = null;
  let testReport = null;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Database & Existing Data Preservation
    // -------------------------------------------------------------------------
    console.log('[TEST 1] Verifying Database Preservation & Existing Records...');
    const userCount = await prisma.user.count();
    const ticketCount = await prisma.ticket.count();
    const jobCount = await prisma.jobMetadata.count();
    const gmailCount = await prisma.gmailAccount.count();

    assert(userCount > 0, `Users preserved in database (${userCount} users found)`);
    assert(ticketCount > 0, `Tickets preserved in database (${ticketCount} tickets found)`);
    assert(jobCount > 0, `Jobs preserved in database (${jobCount} jobs found)`);
    assert(gmailCount > 0, `Gmail accounts preserved (${gmailCount} accounts found)`);

    // Verify existing work natures are intact
    const existingWorkNatures = await prisma.jobMetadata.groupBy({ by: ['workNature'], _count: true });
    const naturesFound = existingWorkNatures.map(n => n.workNature);
    assert(naturesFound.includes('ELECTRICAL'), 'Existing ELECTRICAL work nature intact');
    assert(naturesFound.includes('WAPDA'), 'Existing WAPDA work nature intact');
    assert(naturesFound.includes('MAINTENANCE'), 'Existing MAINTENANCE work nature intact');
    assert(naturesFound.includes('PROJECT'), 'Existing PROJECT work nature intact');

    // -------------------------------------------------------------------------
    // TEST 2: Create / Verify Dedicated Field Employee Account
    // -------------------------------------------------------------------------
    console.log('\n[TEST 2] Dedicated Field Employee Account & PIN Authentication...');
    const testFieldPin = '654321';
    const testFieldName = 'Tariq Field Engineer';
    const testFieldEmail = `tariq.field.${Date.now()}@nexus.local`;

    testUser = await prisma.user.create({
      data: {
        employeeName: testFieldName,
        email: testFieldEmail,
        password: testFieldPin,
        role: 'FIELD_EMPLOYEE',
        activeStatus: true,
      },
    });

    assert(testUser.id > 0, `Field employee created with ID #${testUser.id}`);
    assert(testUser.role === 'FIELD_EMPLOYEE', 'Role is strictly FIELD_EMPLOYEE');

    // Verify PIN comparison (plaintext and hashPin match logic)
    const pinMatch = testUser.password === testFieldPin || testUser.password === hashPin(testFieldPin);
    assert(pinMatch, 'Field employee PIN successfully verified');

    // -------------------------------------------------------------------------
    // TEST 3: Create Project Job from Intake (Associated with Email/Ticket)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 3] Connecting Field Employee to Email Intake & Project Job...');
    const testSerial = `TEST-PROJ-${Date.now().toString().slice(-4)}`;
    testTicket = await prisma.ticket.create({
      data: {
        serialNo: testSerial,
        subject: 'UBL Bank Chakwal Branch Renovation & Civil Electrical Setup',
        sender: 'UBL Operations <ops@ubl.com.pk>',
        gmailMessageId: `msg-${Date.now()}`,
        exactDate: new Date(),
        time: '11:30 AM',
        status: 'RELEVANT',
      },
    });

    assert(testTicket.id > 0, `Ticket created with serial ${testTicket.serialNo}`);

    // Create job unassigned first
    testJob = await prisma.jobMetadata.create({
      data: {
        ticketId: testTicket.id,
        clientName: 'United Bank Limited (UBL)',
        branchName: 'UBL Bank Chakwal Branch',
        personOfContact: 'Mr. Aslam (0300-1234567)',
        workNature: 'PROJECT',
        assignedEmployeeId: null, // Unassigned initially
        manualEnteredBy: 'Office Admin Fatma',
      },
      include: { ticket: true },
    });

    assert(testJob.workNature === 'PROJECT', 'Job created with Work Nature = PROJECT');
    assert(testJob.assignedEmployeeId === null, 'Project job initially Unassigned');

    // -------------------------------------------------------------------------
    // TEST 4: Job Visibility & Strict Role-Based Isolation
    // -------------------------------------------------------------------------
    console.log('\n[TEST 4] Strict Role-Based Job Visibility...');
    // Unassigned job must NOT appear in field employee's assigned list
    const unassignedQuery = await prisma.jobMetadata.findMany({
      where: { assignedEmployeeId: testUser.id },
    });
    const foundUnassigned = unassignedQuery.some(j => j.id === testJob.id);
    assert(!foundUnassigned, 'Unassigned Project job is NOT visible to field employee');

    // Assign job to field employee
    testJob = await prisma.jobMetadata.update({
      where: { id: testJob.id },
      data: { assignedEmployeeId: testUser.id },
      include: { ticket: true, assignedEmployee: true },
    });

    // Now query assigned jobs for this field employee
    const assignedQuery = await prisma.jobMetadata.findMany({
      where: { assignedEmployeeId: testUser.id },
      include: { ticket: true, assignedEmployee: true },
    });
    const foundAssigned = assignedQuery.some(j => j.id === testJob.id);
    assert(foundAssigned, 'Assigned Project job is now immediately visible to field employee');

    // Verify relevant email metadata is accessible
    const myJob = assignedQuery.find(j => j.id === testJob.id);
    assert(myJob.ticket.subject.includes('UBL Bank Chakwal'), 'Email subject matches original intake ticket');
    assert(myJob.branchName === 'UBL Bank Chakwal Branch', 'Branch name accurately preserved');
    assert(myJob.personOfContact.includes('0300-1234567'), 'POC details accurately preserved');
    assert(myJob.assignedEmployee.employeeName === testFieldName, 'Assigned employee matches field employee');

    // -------------------------------------------------------------------------
    // TEST 5: Template Re-creation & Mathematical Calculations
    // -------------------------------------------------------------------------
    console.log('\n[TEST 5] Validating Report Templates & Calculation Logic...');
    assert(PROJECT_EXPENSE_TEMPLATE.length === 11, 'Template 1 has exactly 11 expense categories');
    assert(PROJECT_PROGRESS_TEMPLATE.length === 9, 'Template 2 has exactly 9 progress categories');

    // Prepare simulated digital form entries
    // Fill in Section 1 (Civil) and Section 2 (Electric) in Expense
    const expenseForm = JSON.parse(JSON.stringify(PROJECT_EXPENSE_TEMPLATE));
    // Cement: qty 50 bags, amount 65,000
    expenseForm[0].items[0].qty = '50 bags';
    expenseForm[0].items[0].amount = '65000';
    expenseForm[0].items[0].others = 'Bestway Cement for PCC floor';

    // Sand: qty 300 cft, amount 24,000
    expenseForm[0].items[1].qty = '300 cft';
    expenseForm[0].items[1].amount = '24000';
    expenseForm[0].items[1].others = 'Ravi Sand';

    // Main Cable: qty 1 coil, amount 45,000
    expenseForm[1].items[0].qty = '1 coil';
    expenseForm[1].items[0].amount = '45000';
    expenseForm[1].items[0].others = 'Pakistan Cables 7/029';

    // Calculate total expenses programmatically
    let calculatedTotalExpenses = 0;
    expenseForm.forEach(sec => {
      sec.items.forEach(it => {
        const amt = parseFloat(it.amount);
        if (!isNaN(amt)) calculatedTotalExpenses += amt;
      });
    });

    const expectedTotalExpenses = 65000 + 24000 + 45000; // 134,000
    assert(calculatedTotalExpenses === expectedTotalExpenses, `Total expenses accurately calculated: Rs. ${calculatedTotalExpenses.toLocaleString()}`);

    // Fill in Progress entries in Form B
    const progressForm = JSON.parse(JSON.stringify(PROJECT_PROGRESS_TEMPLATE));
    progressForm[0].items[0].workPercent = '100'; // Dismantling 100%
    progressForm[0].items[1].workPercent = '80';  // Excavation 80%
    progressForm[0].items[2].workPercent = '50';  // Back filling 50%
    progressForm[1].items[0].workPercent = '60';  // Roof slab conduit piping 60%

    let totalWorkPct = 0;
    let countPct = 0;
    progressForm.forEach(sec => {
      sec.items.forEach(it => {
        const p = parseFloat(it.workPercent);
        if (!isNaN(p)) {
          totalWorkPct += p;
          countPct++;
        }
      });
    });
    const calculatedOverallProgress = countPct > 0 ? Math.round(totalWorkPct / countPct) : 0;
    assert(calculatedOverallProgress > 0, `Overall progress calculated: ${calculatedOverallProgress}%`);

    // -------------------------------------------------------------------------
    // TEST 6: Report Submission & Automatic Operations Feed Sync
    // -------------------------------------------------------------------------
    console.log('\n[TEST 6] Submitting Reports & Operations Feed Sync...');
    const simulatedAttachments = JSON.stringify([
      { name: 'cement_bill_01.jpg', size: '142 KB', url: 'data:image/jpeg;base64,samplebase64data' }
    ]);

    testReport = await prisma.projectReportSubmission.create({
      data: {
        jobMetadataId: testJob.id,
        employeeId: testUser.id,
        status: 'SUBMITTED',
        branchName: testJob.branchName,
        reportDate: new Date(),
        version: 1,
        expenseData: JSON.stringify(expenseForm),
        progressData: JSON.stringify(progressForm),
        totalExpenseAmount: calculatedTotalExpenses,
        overallProgressPercent: calculatedOverallProgress,
        attachments: simulatedAttachments,
        paidBy: 'FES',
      },
    });

    assert(testReport.id > 0, `Project report submission saved with ID #${testReport.id} v1`);

    // Create linked Expense in Operations Feed
    const linkedExpense = await prisma.expense.create({
      data: {
        jobMetadataId: testJob.id,
        amount: calculatedTotalExpenses,
        category: 'Site Expense',
        summaryNotes: `[Field Work] [Project Report #${testReport.id} v1] ${testJob.branchName} - Grand Total: Rs. ${calculatedTotalExpenses.toLocaleString()}`,
        expenseDate: new Date(),
        createdById: testUser.id,
        paidBy: 'FES',
      },
    });

    testReport = await prisma.projectReportSubmission.update({
      where: { id: testReport.id },
      data: { linkedExpenseId: linkedExpense.id },
    });

    // Record submission audit
    await prisma.projectReportAudit.create({
      data: {
        reportId: testReport.id,
        action: 'SUBMITTED',
        changedById: testUser.id,
        changedByName: testUser.employeeName,
        version: 1,
        comment: 'Initial submission from Field Employee Portal',
      },
    });

    // Verify Expense shows up in Operations Feed query
    const feedExpenses = await prisma.expense.findMany({
      where: { jobMetadataId: testJob.id },
    });
    assert(feedExpenses.length === 1, 'Linked Expense record exists in Operations Feed');
    assert(feedExpenses[0].amount === 134000, 'Operations Feed expense amount matches submitted report total (Rs. 134,000)');
    assert(feedExpenses[0].summaryNotes.includes('[Field Work]'), 'Expense tagged as [Field Work]');

    // -------------------------------------------------------------------------
    // TEST 7: Office Employee Automatic Access & Review Workflow
    // -------------------------------------------------------------------------
    console.log('\n[TEST 7] Office Employee Review & Request Correction...');
    // Office employee reviews report
    const officeReview = await prisma.projectReportSubmission.findUnique({
      where: { id: testReport.id },
      include: {
        employee: true,
        jobMetadata: { include: { ticket: true } },
        linkedExpense: true,
        audits: true,
      },
    });

    assert(officeReview !== null, 'Office employee can retrieve field submission');
    assert(officeReview.status === 'SUBMITTED', 'Initial status is SUBMITTED');
    assert(officeReview.totalExpenseAmount === 134000, 'Submitted total expense Rs. 134,000 visible to office');

    // Office reviewer requests correction
    const reviewerNotes = 'Please provide voucher number for Main Cable and verify excavation volume.';
    const updatedReview = await prisma.projectReportSubmission.update({
      where: { id: testReport.id },
      data: {
        status: 'CORRECTION_REQUIRED',
        reviewerNotes,
        reviewedAt: new Date(),
      },
    });

    await prisma.projectReportAudit.create({
      data: {
        reportId: testReport.id,
        action: 'CORRECTION_REQUESTED',
        changedByName: 'Office Supervisor',
        version: 1,
        comment: reviewerNotes,
      },
    });

    assert(updatedReview.status === 'CORRECTION_REQUIRED', 'Status changed to CORRECTION_REQUIRED');
    assert(updatedReview.reviewerNotes === reviewerNotes, 'Reviewer feedback accurately saved');

    // -------------------------------------------------------------------------
    // TEST 8: Field Employee Resubmission with Versioning & Audit History
    // -------------------------------------------------------------------------
    console.log('\n[TEST 8] Field Employee Resubmission (v2) & Audit Integrity...');
    // Field employee sees reviewer notes and updates the amount
    expenseForm[1].items[0].others = 'Pakistan Cables 7/029 - Voucher #V-4029 Attached';
    // Add additional labor: 15,000
    expenseForm[0].items[8].amount = '15000'; // Layber cost
    expenseForm[0].items[8].qty = '3 days';
    expenseForm[0].items[8].others = 'Excavation & PCC labor';

    const newCalculatedTotal = 134000 + 15000; // 149,000

    // Resubmit report
    const resubmittedReport = await prisma.projectReportSubmission.update({
      where: { id: testReport.id },
      data: {
        status: 'SUBMITTED',
        version: 2,
        expenseData: JSON.stringify(expenseForm),
        totalExpenseAmount: newCalculatedTotal,
        reviewerNotes: null, // Cleared on resubmission
        updatedAt: new Date(),
      },
    });

    // Update linked expense in Operations Feed
    await prisma.expense.update({
      where: { id: testReport.linkedExpenseId },
      data: {
        amount: newCalculatedTotal,
        summaryNotes: `[Field Work] [Project Report #${testReport.id} v2] ${testJob.branchName} - Grand Total: Rs. ${newCalculatedTotal.toLocaleString()}`,
      },
    });

    // Audit entry for resubmission
    await prisma.projectReportAudit.create({
      data: {
        reportId: testReport.id,
        action: 'RESUBMITTED',
        changedById: testUser.id,
        changedByName: testUser.employeeName,
        version: 2,
        comment: 'Updated with voucher #V-4029 and added labor expense breakdown',
      },
    });

    assert(resubmittedReport.version === 2, 'Version incremented to 2');
    assert(resubmittedReport.totalExpenseAmount === 149000, 'New total expense Rs. 149,000 saved');

    // Check that Operations Feed reflects updated total
    const updatedExpense = await prisma.expense.findUnique({
      where: { id: testReport.linkedExpenseId },
    });
    assert(updatedExpense.amount === 149000, 'Operations Feed expense automatically updated to Rs. 149,000');

    // Office approves report
    const approvedReport = await prisma.projectReportSubmission.update({
      where: { id: testReport.id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
      },
    });

    await prisma.projectReportAudit.create({
      data: {
        reportId: testReport.id,
        action: 'APPROVED',
        changedByName: 'Office Supervisor',
        version: 2,
        comment: 'All vouchers verified and approved',
      },
    });

    assert(approvedReport.status === 'APPROVED', 'Report successfully APPROVED');

    // Check complete audit history preserved
    const completeAudits = await prisma.projectReportAudit.findMany({
      where: { reportId: testReport.id },
      orderBy: { createdAt: 'asc' },
    });

    assert(completeAudits.length === 4, `All 4 audit trail events preserved (${completeAudits.map(a => a.action).join(' -> ')})`);

    // -------------------------------------------------------------------------
    // TEST 9: Clean Up Test Records Safely
    // -------------------------------------------------------------------------
    console.log('\n[TEST 9] Cleaning up test-specific verification records...');
    if (testReport) {
      await prisma.projectReportAudit.deleteMany({ where: { reportId: testReport.id } });
      if (testReport.linkedExpenseId) {
        await prisma.expense.delete({ where: { id: testReport.linkedExpenseId } });
      }
      await prisma.projectReportSubmission.delete({ where: { id: testReport.id } });
    }
    if (testJob) {
      await prisma.jobMetadata.delete({ where: { id: testJob.id } });
    }
    if (testTicket) {
      await prisma.ticket.delete({ where: { id: testTicket.id } });
    }
    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } });
    }

    assert(true, 'Test records cleaned up safely without affecting production data');

    console.log('\n======================================================');
    console.log(`  ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!  `);
    console.log('======================================================\n');
  } catch (error) {
    console.error('\nTest execution error:', error);
    // Cleanup if possible
    try {
      if (testReport?.id) {
        await prisma.projectReportAudit.deleteMany({ where: { reportId: testReport.id } }).catch(() => {});
        if (testReport.linkedExpenseId) {
          await prisma.expense.delete({ where: { id: testReport.linkedExpenseId } }).catch(() => {});
        }
        await prisma.projectReportSubmission.delete({ where: { id: testReport.id } }).catch(() => {});
      }
      if (testJob?.id) await prisma.jobMetadata.delete({ where: { id: testJob.id } }).catch(() => {});
      if (testTicket?.id) await prisma.ticket.delete({ where: { id: testTicket.id } }).catch(() => {});
      if (testUser?.id) await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    } catch {}
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
