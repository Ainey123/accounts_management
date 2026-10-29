import { NextResponse } from 'next/server';
import { prisma, withDbRetry } from '@/lib/prisma';
import { nextTicketSerialNo } from '@/lib/serial';
import {
  FES_PROJECT_SITES,
  normalizeProgressSections,
  extractProjectExpenses,
  buildExpenseSectionsFromEntries,
} from '@/lib/projectReportTemplates';

export const dynamic = 'force-dynamic';

function getUserFromRequest(request) {
  const authCookie = request.headers.get('x-user-id') || request.cookies.get('nexus_user')?.value;
  if (!authCookie) return null;
  try {
    const decoded = typeof authCookie === 'string' ? decodeURIComponent(authCookie) : authCookie;
    return decoded.startsWith('{') ? JSON.parse(decoded) : null;
  } catch {
    return null;
  }
}

function resolveProjectStatus(job, latestReport, overallProgress) {
  if (latestReport?.progressData) {
    try {
      const parsed = JSON.parse(latestReport.progressData);
      if (Array.isArray(parsed) && parsed[0]?.sheetMeta?.projectStatus) {
        return parsed[0].sheetMeta.projectStatus;
      }
    } catch {}
  }
  if (job?.workCompletion?.status && ['COMPLETED', 'IN_PROGRESS', 'ON_HOLD', 'NOT_STARTED'].includes(job.workCompletion.status)) {
    return job.workCompletion.status;
  }
  if (overallProgress >= 100) return 'COMPLETED';
  if (overallProgress > 0 || latestReport) return 'IN_PROGRESS';
  return 'NOT_STARTED';
}

function formatProjectPayload(siteDef, job) {
  const latestReport = job?.projectReports?.[0] || null;
  const progressSections = normalizeProgressSections(latestReport?.progressData);
  const sheetMeta = progressSections?.[0]?.sheetMeta || {};

  let pctTotal = 0;
  let pctCount = 0;
  progressSections.forEach((sec) => {
    (sec.items || []).forEach((it) => {
      const p = parseFloat(it.workPercent);
      if (!isNaN(p)) {
        pctTotal += p;
        pctCount++;
      }
    });
  });
  const computedProgress =
    pctCount > 0
      ? Math.round(pctTotal / pctCount)
      : Math.round(latestReport?.overallProgressPercent || 0);

  const expenseBreakdown = extractProjectExpenses(
    latestReport?.expenseData,
    job?.expenses || [],
    latestReport?.linkedExpenseId
  );

  const projectStatus = resolveProjectStatus(job, latestReport, computedProgress);

  let attachments = [];
  if (latestReport?.attachments) {
    try {
      const parsedAtt = JSON.parse(latestReport.attachments);
      if (Array.isArray(parsedAtt)) attachments = parsedAtt;
    } catch {}
  }

  return {
    key: siteDef.key,
    label: siteDef.label,
    branchName: sheetMeta.branchSite || job?.branchName || siteDef.branchName,
    jobMetadataId: job?.id || null,
    serialNo: job?.ticket?.serialNo || null,
    reportId: latestReport?.id || null,
    reportStatus: latestReport?.status || null,
    version: latestReport?.version || 1,
    reviewerNotes: latestReport?.reviewerNotes || null,
    projectStatus,
    overallProgressPercent: computedProgress,
    projectExpense: expenseBreakdown.projectExpense,
    materialExpense: expenseBreakdown.materialExpense,
    labourExpense: expenseBreakdown.labourExpense,
    otherExpense: expenseBreakdown.otherExpense,
    expenseEntries: expenseBreakdown.entries,
    progressSections,
    reportDate:
      sheetMeta.reportDate ||
      (latestReport?.reportDate ? new Date(latestReport.reportDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
    siteSupervisor: sheetMeta.siteSupervisor || latestReport?.employee?.employeeName || '',
    targetCompletion: sheetMeta.targetCompletion || '',
    paidBy: latestReport?.paidBy || 'FES',
    attachments,
    updatedAt: latestReport?.updatedAt || job?.updatedAt || null,
  };
}

/**
 * GET /api/field-projects
 * Returns canonical dashboard data for Manawala, Kanjwahl, Muradshah, Tordywala, and Other projects.
 */
export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const standardSites = FES_PROJECT_SITES.filter((s) => s.key !== 'other');

    const jobs = await withDbRetry(() =>
      prisma.jobMetadata.findMany({
        where: {
          OR: [
            { workNature: 'PROJECT' },
            ...standardSites.map((s) => ({
              branchName: { contains: s.branchName, mode: 'insensitive' },
            })),
          ],
        },
        orderBy: { updatedAt: 'desc' },
        include: {
          ticket: true,
          expenses: { orderBy: { createdAt: 'desc' } },
          workCompletion: true,
          projectReports: {
            orderBy: { updatedAt: 'desc' },
            include: {
              employee: { select: { id: true, employeeName: true, email: true } },
              reviewedBy: { select: { id: true, employeeName: true, email: true } },
              audits: { orderBy: { createdAt: 'desc' } },
            },
          },
        },
      })
    );

    const usedJobIds = new Set();

    const standardProjects = standardSites.map((site) => {
      const exactMatch = jobs.find(
        (j) =>
          !usedJobIds.has(j.id) &&
          (j.branchName || '').trim().toLowerCase() === site.branchName.toLowerCase()
      );
      const partialMatch =
        exactMatch ||
        jobs.find(
          (j) =>
            !usedJobIds.has(j.id) &&
            (j.branchName || '').toLowerCase().includes(site.branchName.toLowerCase())
        );

      if (partialMatch) usedJobIds.add(partialMatch.id);
      return formatProjectPayload(site, partialMatch || null);
    });

    const otherJobs = jobs.filter((j) => !usedJobIds.has(j.id));
    const otherProjects = otherJobs.map((j) =>
      formatProjectPayload(
        {
          key: `other-${j.id}`,
          label: j.branchName || 'Other Project',
          branchName: j.branchName || 'Other',
        },
        j
      )
    );

    // Default "Other" slot (uses latest custom Other project if any, or blank template)
    const primaryOther =
      otherProjects[0]
        ? { ...otherProjects[0], key: 'other', label: 'Other' }
        : formatProjectPayload(FES_PROJECT_SITES.find((s) => s.key === 'other'), null);

    return NextResponse.json({
      projects: [...standardProjects, primaryOther],
      otherProjects,
      success: true,
    });
  } catch (error) {
    console.error('GET /api/field-projects error:', error);
    return NextResponse.json(
      { error: 'Failed to load field projects: ' + error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/field-projects
 * Saves or submits Project Status, Expenses (Material & Labour), and the 9-Page Progress Sheet.
 */
export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const {
      projectKey = 'manawala',
      jobMetadataId,
      branchName,
      projectStatus = 'IN_PROGRESS',
      reportDate,
      siteSupervisor,
      targetCompletion = '',
      progressSections = [],
      expenseEntries = [],
      paidBy = 'FES',
      attachments = [],
      submitAction = 'DRAFT', // 'DRAFT' | 'SUBMIT' | 'EXPENSE_UPDATE' | 'STATUS_UPDATE'
    } = body;

    // Resolve a valid User ID in DB for foreign key integrity
    let employeeId = user?.id ? Number(user.id) : null;
    if (!employeeId || Number.isNaN(employeeId)) {
      const fallbackUser = await withDbRetry(() =>
        prisma.user.findFirst({
          where: { activeStatus: true },
          orderBy: { id: 'asc' },
          select: { id: true },
        })
      );
      employeeId = fallbackUser?.id || null;
    }

    if (!employeeId) {
      return NextResponse.json(
        { error: 'No active employee record found in database to link submission.' },
        { status: 400 }
      );
    }

    const cleanBranch = (branchName || '').trim() || 'Other';
    const supervisorName = (siteSupervisor || user?.employeeName || 'Field Supervisor').trim();

    // 1. Resolve or create JobMetadata for this project site
    let job = null;
    if (jobMetadataId && !Number.isNaN(Number(jobMetadataId))) {
      job = await withDbRetry(() =>
        prisma.jobMetadata.findUnique({
          where: { id: Number(jobMetadataId) },
          include: { ticket: true, expenses: true },
        })
      );
    }

    if (!job) {
      job = await withDbRetry(() =>
        prisma.jobMetadata.findFirst({
          where: {
            workNature: 'PROJECT',
            branchName: { equals: cleanBranch, mode: 'insensitive' },
          },
          orderBy: { updatedAt: 'desc' },
          include: { ticket: true, expenses: true },
        })
      );
    }

    if (!job) {
      const serialNo = await nextTicketSerialNo();
      const newTicket = await withDbRetry(() =>
        prisma.ticket.create({
          data: {
            gmailMessageId: `field-proj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            serialNo,
            subject: `FES Site Project — ${cleanBranch}`,
            sender: supervisorName,
            exactDate: new Date(),
            time: new Date().toTimeString().slice(0, 5),
            status: 'RELEVANT',
            statusLastChangedBy: supervisorName,
            createdById: employeeId,
          },
        })
      );

      job = await withDbRetry(() =>
        prisma.jobMetadata.create({
          data: {
            ticketId: newTicket.id,
            clientName: 'Fast Engineering Solutions',
            branchName: cleanBranch,
            personOfContact: supervisorName,
            workNature: 'PROJECT',
            assignedEmployeeId: employeeId,
            manualEnteredBy: supervisorName,
            createdById: employeeId,
          },
          include: { ticket: true, expenses: true },
        })
      );
    } else if (projectKey === 'other' && cleanBranch && job.branchName !== cleanBranch) {
      job = await withDbRetry(() =>
        prisma.jobMetadata.update({
          where: { id: job.id },
          data: { branchName: cleanBranch },
          include: { ticket: true, expenses: true },
        })
      );
    }

    // 2. Prepare normalized Progress Sections + Sheet Metadata
    const normalizedProgress = normalizeProgressSections(progressSections);
    if (normalizedProgress.length > 0) {
      normalizedProgress[0].sheetMeta = {
        projectKey,
        branchSite: cleanBranch,
        reportDate: reportDate || new Date().toISOString().split('T')[0],
        siteSupervisor: supervisorName,
        targetCompletion: targetCompletion || '',
        projectStatus,
      };
    }

    let pctSum = 0;
    let pctCount = 0;
    normalizedProgress.forEach((sec) => {
      (sec.items || []).forEach((it) => {
        const p = parseFloat(it.workPercent);
        if (!isNaN(p)) {
          pctSum += p;
          pctCount++;
        }
      });
    });
    const overallProgressPercent = pctCount > 0 ? Math.round(pctSum / pctCount) : 0;

    // 3. Build Expense Sections & Totals
    const expenseSections = buildExpenseSectionsFromEntries(expenseEntries);
    let materialTotal = 0;
    let labourTotal = 0;
    let otherTotal = 0;

    expenseEntries.forEach((e) => {
      if (e.fromStandaloneExpense) return;
      const amt = parseFloat(e.amount) || 0;
      if (amt <= 0) return;
      if (e.type === 'LABOUR') labourTotal += amt;
      else if (e.type === 'MATERIAL') materialTotal += amt;
      else otherTotal += amt;
    });
    const reportExpenseTotal = materialTotal + labourTotal + otherTotal;

    const finalProgressJson = JSON.stringify(normalizedProgress);
    const finalExpenseJson = JSON.stringify(expenseSections);
    const finalAttachmentsJson =
      typeof attachments === 'string' ? attachments : JSON.stringify(attachments || []);

    const existingReport = await withDbRetry(() =>
      prisma.projectReportSubmission.findFirst({
        where: { jobMetadataId: job.id },
        orderBy: { updatedAt: 'desc' },
      })
    );

    const isFormalSubmit = submitAction === 'SUBMIT';
    const nextStatus = isFormalSubmit
      ? 'SUBMITTED'
      : existingReport?.status === 'APPROVED'
      ? 'APPROVED'
      : existingReport?.status === 'SUBMITTED'
      ? 'SUBMITTED'
      : 'IN_PROGRESS';

    let savedReport;
    if (existingReport) {
      const nextVersion = isFormalSubmit ? existingReport.version + 1 : existingReport.version;
      savedReport = await withDbRetry(() =>
        prisma.projectReportSubmission.update({
          where: { id: existingReport.id },
          data: {
            employeeId,
            branchName: cleanBranch,
            reportDate: reportDate ? new Date(reportDate) : new Date(),
            version: nextVersion,
            expenseData: finalExpenseJson,
            progressData: finalProgressJson,
            totalExpenseAmount: reportExpenseTotal,
            overallProgressPercent,
            attachments: finalAttachmentsJson,
            paidBy,
            status: nextStatus,
            updatedAt: new Date(),
          },
        })
      );

      await withDbRetry(() =>
        prisma.projectReportAudit.create({
          data: {
            reportId: savedReport.id,
            action: isFormalSubmit ? 'SUBMITTED' : 'UPDATED',
            changedById: employeeId,
            changedByName: supervisorName,
            version: nextVersion,
            comment: isFormalSubmit
              ? `Progress (${overallProgressPercent}%) & Expenses (Rs. ${reportExpenseTotal.toLocaleString()}) submitted for ${cleanBranch}`
              : `Updated ${cleanBranch} dashboard (${submitAction})`,
          },
        })
      );
    } else {
      savedReport = await withDbRetry(() =>
        prisma.projectReportSubmission.create({
          data: {
            jobMetadataId: job.id,
            employeeId,
            status: isFormalSubmit ? 'SUBMITTED' : 'IN_PROGRESS',
            branchName: cleanBranch,
            reportDate: reportDate ? new Date(reportDate) : new Date(),
            version: 1,
            expenseData: finalExpenseJson,
            progressData: finalProgressJson,
            totalExpenseAmount: reportExpenseTotal,
            overallProgressPercent,
            attachments: finalAttachmentsJson,
            paidBy,
          },
        })
      );

      await withDbRetry(() =>
        prisma.projectReportAudit.create({
          data: {
            reportId: savedReport.id,
            action: isFormalSubmit ? 'SUBMITTED' : 'DRAFT_SAVED',
            changedById: employeeId,
            changedByName: supervisorName,
            version: 1,
            comment: `Initialized project dashboard & progress sheet for ${cleanBranch}`,
          },
        })
      );
    }

    // 4. Sync linked Expense record in main Expense ledger so Admin financials stay accurate
    let firstReceipt = null;
    try {
      const attList = JSON.parse(finalAttachmentsJson);
      if (Array.isArray(attList) && attList.length > 0) {
        firstReceipt = typeof attList[0] === 'string' ? attList[0] : attList[0]?.url || null;
      }
    } catch {}
    if (!firstReceipt) {
      const withReceipt = expenseEntries.find((e) => e.receiptUrl && !e.fromStandaloneExpense);
      if (withReceipt) firstReceipt = withReceipt.receiptUrl;
    }

    const summaryText = `[Field Work] [Project Report #${savedReport.id}] ${cleanBranch} — Material: Rs. ${materialTotal.toLocaleString()} | Labour: Rs. ${labourTotal.toLocaleString()} | Total: Rs. ${reportExpenseTotal.toLocaleString()}`;

    if (reportExpenseTotal > 0) {
      if (savedReport.linkedExpenseId) {
        await withDbRetry(() =>
          prisma.expense.update({
            where: { id: savedReport.linkedExpenseId },
            data: {
              amount: reportExpenseTotal,
              paidBy,
              summaryNotes: summaryText,
              imageUrl: firstReceipt,
              expenseDate: reportDate ? new Date(reportDate) : new Date(),
            },
          })
        ).catch(() => {});
      } else {
        const createdExp = await withDbRetry(() =>
          prisma.expense.create({
            data: {
              jobMetadataId: job.id,
              amount: reportExpenseTotal,
              imageUrl: firstReceipt,
              summaryNotes: summaryText,
              category: 'Site Expense',
              expenseDate: reportDate ? new Date(reportDate) : new Date(),
              createdById: employeeId,
              paidBy,
            },
          })
        );
        savedReport = await withDbRetry(() =>
          prisma.projectReportSubmission.update({
            where: { id: savedReport.id },
            data: { linkedExpenseId: createdExp.id },
          })
        );
      }
    } else if (savedReport.linkedExpenseId) {
      await withDbRetry(() =>
        prisma.expense.update({
          where: { id: savedReport.linkedExpenseId },
          data: { amount: 0, summaryNotes: summaryText },
        })
      ).catch(() => {});
    }

    // Sync job workCompletion status safely
    await withDbRetry(() =>
      prisma.workCompletion.upsert({
        where: { jobMetadataId: job.id },
        update: {
          status: projectStatus,
          notes: `Progress: ${overallProgressPercent}% | Updated by ${supervisorName}`,
        },
        create: {
          jobMetadataId: job.id,
          createdById: employeeId,
          status: projectStatus,
          amount: reportExpenseTotal,
          notes: `Progress: ${overallProgressPercent}% | Updated by ${supervisorName}`,
        },
      })
    ).catch(() => {});

    // Re-fetch updated job with relations to return canonical project state
    const refreshedJob = await withDbRetry(() =>
      prisma.jobMetadata.findUnique({
        where: { id: job.id },
        include: {
          ticket: true,
          expenses: { orderBy: { createdAt: 'desc' } },
          workCompletion: true,
          projectReports: {
            orderBy: { updatedAt: 'desc' },
            include: {
              employee: { select: { id: true, employeeName: true, email: true } },
              reviewedBy: { select: { id: true, employeeName: true, email: true } },
              audits: { orderBy: { createdAt: 'desc' } },
            },
          },
        },
      })
    );

    const matchedSite =
      FES_PROJECT_SITES.find((s) => s.key === projectKey) || {
        key: projectKey,
        label: cleanBranch,
        branchName: cleanBranch,
      };

    return NextResponse.json({
      project: formatProjectPayload(matchedSite, refreshedJob),
      success: true,
    });
  } catch (error) {
    console.error('POST /api/field-projects error:', error);
    return NextResponse.json(
      { error: 'Failed to save project data: ' + error.message },
      { status: 500 }
    );
  }
}
