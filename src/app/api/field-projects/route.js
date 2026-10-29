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

function normalizeDemandList(rawDemands, siteDef, job, latestReport, sheetMeta) {
  if (!Array.isArray(rawDemands)) return [];
  const resolvedBranch = sheetMeta?.branchSite || job?.branchName || siteDef?.branchName || 'Project Site';
  const fallbackRequester =
    sheetMeta?.siteSupervisor || latestReport?.employee?.employeeName || 'Field Employee';

  return rawDemands
    .filter((d) => d && (d.id || d.amount !== undefined || d.formData))
    .map((d, idx) => ({
      id: d.id || `dem-${latestReport?.id || 0}-${idx}`,
      type: d.type === 'PAYMENT' ? 'PAYMENT' : 'MATERIAL',
      amount: parseFloat(d.amount) || 0,
      description: d.description || '',
      formData: d.formData || null,
      status: ['HOLD', 'ACCEPT', 'REJECT'].includes(d.status) ? d.status : 'HOLD',
      projectKey: d.projectKey || siteDef?.key || 'manawala',
      branchName: d.branchName || resolvedBranch,
      jobMetadataId: job?.id || null,
      reportId: latestReport?.id || null,
      requestedBy: d.requestedBy || fallbackRequester,
      requestedById: d.requestedById || null,
      reviewedBy: d.reviewedBy || null,
      adminNote: d.adminNote || '',
      createdAt: d.createdAt || latestReport?.createdAt || new Date().toISOString(),
      updatedAt: d.updatedAt || d.createdAt || new Date().toISOString(),
    }));
}

function extractDemandsFromReport(report) {
  if (!report?.progressData) return [];
  try {
    const parsed =
      typeof report.progressData === 'string'
        ? JSON.parse(report.progressData)
        : report.progressData;
    if (Array.isArray(parsed) && Array.isArray(parsed[0]?.sheetMeta?.demands)) {
      return parsed[0].sheetMeta.demands;
    }
  } catch {}
  return [];
}

function formatProjectPayload(siteDef, job) {
  const latestReport = job?.projectReports?.[0] || null;
  const progressSections = normalizeProgressSections(latestReport?.progressData);
  const sheetMeta = progressSections?.[0]?.sheetMeta || {};
  const demands = normalizeDemandList(sheetMeta.demands, siteDef, job, latestReport, sheetMeta);

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
    demands,
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

    // Deduplicated full list of all projects for Admin Field Employees dashboard
    const allProjects =
      otherProjects.length > 0
        ? [...standardProjects, ...otherProjects]
        : [...standardProjects, primaryOther];

    const allDemands = allProjects
      .flatMap((proj) =>
        (proj.demands || []).map((d) => ({
          ...d,
          projectLabel: proj.label,
          branchName: proj.branchName || d.branchName,
          jobMetadataId: proj.jobMetadataId || d.jobMetadataId,
          reportId: proj.reportId || d.reportId,
        }))
      )
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    return NextResponse.json({
      projects: [...standardProjects, primaryOther],
      otherProjects,
      allProjects,
      allDemands,
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

    // 2. Check existing report first so submitted Demands & Admin decisions are NEVER overwritten
    const existingReport = await withDbRetry(() =>
      prisma.projectReportSubmission.findFirst({
        where: { jobMetadataId: job.id },
        orderBy: { updatedAt: 'desc' },
      })
    );
    const existingDemands = extractDemandsFromReport(existingReport);

    // Prepare normalized Progress Sections + Sheet Metadata (preserving demands)
    const normalizedProgress = normalizeProgressSections(progressSections);
    if (normalizedProgress.length > 0) {
      normalizedProgress[0].sheetMeta = {
        projectKey,
        branchSite: cleanBranch,
        reportDate: reportDate || new Date().toISOString().split('T')[0],
        siteSupervisor: supervisorName,
        targetCompletion: targetCompletion || '',
        projectStatus,
        demands: existingDemands,
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

/**
 * PATCH /api/field-projects
 * Handles Field Employee Demand submissions (Material Demand / Payment Demand)
 * and Admin Demand status decisions (HOLD / ACCEPT / REJECT).
 */
export async function PATCH(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION 1: CREATE_DEMAND (Material Demand or Payment Demand)
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'CREATE_DEMAND') {
      const {
        projectKey = 'manawala',
        jobMetadataId,
        branchName,
        demandType = 'MATERIAL',
        amount,
        description = '',
        siteSupervisor,
        formData = null,
      } = body;

      const normalizedType = demandType === 'PAYMENT' ? 'PAYMENT' : 'MATERIAL';

      // Resolve amount from manual input or Payment Demand sheet totals
      let parsedAmount = parseFloat(amount);
      if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        const netFromForm = parseFloat(formData?.netAmountDemanded);
        const totalFromForm = parseFloat(formData?.totalAmountRequired);
        if (!Number.isNaN(netFromForm) && netFromForm > 0) {
          parsedAmount = netFromForm;
        } else if (!Number.isNaN(totalFromForm) && totalFromForm > 0) {
          parsedAmount = totalFromForm;
        } else {
          parsedAmount = 0;
        }
      }

      const filledFormItems = Array.isArray(formData?.items)
        ? formData.items.filter(
            (it) =>
              (it.description || '').trim() ||
              (it.requiredQty || '').toString().trim() ||
              (parseFloat(it.amount) || 0) > 0
          )
        : [];

      if (parsedAmount <= 0 && filledFormItems.length === 0 && !(description || '').trim()) {
        return NextResponse.json(
          { error: 'Please fill the demand form rows or enter a demand amount greater than 0.' },
          { status: 400 }
        );
      }

      const autoSummary =
        (description || '').trim() ||
        filledFormItems
          .slice(0, 3)
          .map((it) =>
            normalizedType === 'MATERIAL'
              ? `${it.description || 'Material'}${it.requiredQty ? ` (${it.requiredQty}${it.unit ? ' ' + it.unit : ''})` : ''}`
              : `${it.description || 'Payment'}${it.amount ? ` (Rs. ${Number(it.amount).toLocaleString()})` : ''}`
          )
          .join(', ') ||
        formData?.purpose ||
        formData?.purposeJustification ||
        '';

      const cleanBranch = (branchName || '').trim() || 'Other';
      const requesterName = (
        formData?.requestedBy ||
        formData?.siteInCharge ||
        siteSupervisor ||
        user?.employeeName ||
        'Field Employee'
      ).trim();

      // Resolve a valid employeeId in DB
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
        const anyUser = await withDbRetry(() =>
          prisma.user.findFirst({ orderBy: { id: 'asc' }, select: { id: true } })
        );
        employeeId = anyUser?.id || null;
      }
      if (!employeeId) {
        return NextResponse.json(
          { error: 'No active employee record found in database to link demand.' },
          { status: 400 }
        );
      }

      // Resolve or create JobMetadata for this site
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
              sender: requesterName,
              exactDate: new Date(),
              time: new Date().toTimeString().slice(0, 5),
              status: 'RELEVANT',
              statusLastChangedBy: requesterName,
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
              personOfContact: requesterName,
              workNature: 'PROJECT',
              assignedEmployeeId: employeeId,
              manualEnteredBy: requesterName,
              createdById: employeeId,
            },
            include: { ticket: true, expenses: true },
          })
        );
      }

      const existingReport = await withDbRetry(() =>
        prisma.projectReportSubmission.findFirst({
          where: { jobMetadataId: job.id },
          orderBy: { updatedAt: 'desc' },
        })
      );

      const normalizedProgress = normalizeProgressSections(existingReport?.progressData);
      const prevMeta = normalizedProgress?.[0]?.sheetMeta || {};
      const existingDemands = extractDemandsFromReport(existingReport);

      const nowIso = new Date().toISOString();
      const newDemand = {
        id: `dem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: normalizedType,
        amount: parsedAmount,
        description: autoSummary,
        formData: formData || null,
        status: 'HOLD',
        projectKey: projectKey || prevMeta.projectKey || 'manawala',
        branchName: cleanBranch,
        requestedBy: requesterName,
        requestedById: user?.id ? Number(user.id) : null,
        reviewedBy: null,
        adminNote: '',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      if (normalizedProgress.length > 0) {
        normalizedProgress[0].sheetMeta = {
          projectKey: projectKey || prevMeta.projectKey || 'manawala',
          branchSite: cleanBranch,
          reportDate: prevMeta.reportDate || nowIso.split('T')[0],
          siteSupervisor: prevMeta.siteSupervisor || requesterName,
          targetCompletion: prevMeta.targetCompletion || '',
          projectStatus: prevMeta.projectStatus || 'IN_PROGRESS',
          demands: [newDemand, ...existingDemands],
        };
      }

      const progressJson = JSON.stringify(normalizedProgress);
      let savedReport;

      if (existingReport) {
        savedReport = await withDbRetry(() =>
          prisma.projectReportSubmission.update({
            where: { id: existingReport.id },
            data: {
              progressData: progressJson,
              updatedAt: new Date(),
            },
          })
        );
      } else {
        const emptyExpenses = JSON.stringify(buildExpenseSectionsFromEntries([]));
        savedReport = await withDbRetry(() =>
          prisma.projectReportSubmission.create({
            data: {
              jobMetadataId: job.id,
              employeeId,
              status: 'IN_PROGRESS',
              branchName: cleanBranch,
              reportDate: new Date(),
              version: 1,
              expenseData: emptyExpenses,
              progressData: progressJson,
              totalExpenseAmount: 0,
              overallProgressPercent: 0,
              attachments: '[]',
              paidBy: 'FES',
            },
          })
        );
      }

      await withDbRetry(() =>
        prisma.projectReportAudit.create({
          data: {
            reportId: savedReport.id,
            action: 'DEMAND_SUBMITTED',
            changedById: user?.id ? Number(user.id) : null,
            changedByName: requesterName,
            version: savedReport.version || 1,
            comment: `${normalizedType === 'PAYMENT' ? 'Payment' : 'Material'} Demand of Rs. ${parsedAmount.toLocaleString()} submitted for ${cleanBranch} (Status: HOLD)`,
          },
        })
      ).catch(() => {});

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
        demand: { ...newDemand, jobMetadataId: job.id, reportId: savedReport.id },
        project: formatProjectPayload(matchedSite, refreshedJob),
        success: true,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION 2: UPDATE_DEMAND_STATUS (Admin: HOLD | ACCEPT | REJECT)
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'UPDATE_DEMAND_STATUS') {
      if (user.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Admin authorization required to update demand status.' },
          { status: 403 }
        );
      }

      const { demandId, status, reportId, jobMetadataId, adminNote } = body;
      if (!demandId || !['HOLD', 'ACCEPT', 'REJECT'].includes(status)) {
        return NextResponse.json(
          { error: 'Valid demandId and status (HOLD, ACCEPT, or REJECT) are required.' },
          { status: 400 }
        );
      }

      let targetReport = null;
      if (reportId && !Number.isNaN(Number(reportId))) {
        targetReport = await withDbRetry(() =>
          prisma.projectReportSubmission.findUnique({
            where: { id: Number(reportId) },
          })
        );
      }

      if (!targetReport && jobMetadataId && !Number.isNaN(Number(jobMetadataId))) {
        targetReport = await withDbRetry(() =>
          prisma.projectReportSubmission.findFirst({
            where: { jobMetadataId: Number(jobMetadataId) },
            orderBy: { updatedAt: 'desc' },
          })
        );
      }

      if (!targetReport) {
        const candidateReports = await withDbRetry(() =>
          prisma.projectReportSubmission.findMany({
            orderBy: { updatedAt: 'desc' },
            take: 100,
          })
        );
        targetReport =
          candidateReports.find((r) =>
            extractDemandsFromReport(r).some((d) => d.id === demandId)
          ) || null;
      }

      if (!targetReport) {
        return NextResponse.json(
          { error: 'Demand parent project record not found.' },
          { status: 404 }
        );
      }

      const normalizedProgress = normalizeProgressSections(targetReport.progressData);
      const prevMeta = normalizedProgress?.[0]?.sheetMeta || {};
      const existingDemands = extractDemandsFromReport(targetReport);

      const targetIndex = existingDemands.findIndex((d) => d.id === demandId);
      if (targetIndex === -1) {
        return NextResponse.json({ error: 'Demand item not found.' }, { status: 404 });
      }

      const reviewerLabel = user?.employeeName || 'Admin';
      const nowIso = new Date().toISOString();
      const prevFormData = existingDemands[targetIndex].formData || null;
      const nextFormData =
        prevFormData && status === 'ACCEPT'
          ? {
              ...prevFormData,
              approvedByName: prevFormData.approvedByName || reviewerLabel,
              approvedBySign: prevFormData.approvedBySign || reviewerLabel,
            }
          : prevFormData;

      const updatedDemand = {
        ...existingDemands[targetIndex],
        status,
        formData: nextFormData,
        reviewedBy: reviewerLabel,
        adminNote:
          adminNote !== undefined ? String(adminNote).trim() : existingDemands[targetIndex].adminNote || '',
        updatedAt: nowIso,
      };

      const nextDemands = [...existingDemands];
      nextDemands[targetIndex] = updatedDemand;

      if (normalizedProgress.length > 0) {
        normalizedProgress[0].sheetMeta = {
          ...prevMeta,
          demands: nextDemands,
        };
      }

      const savedReport = await withDbRetry(() =>
        prisma.projectReportSubmission.update({
          where: { id: targetReport.id },
          data: {
            progressData: JSON.stringify(normalizedProgress),
            updatedAt: new Date(),
          },
        })
      );

      await withDbRetry(() =>
        prisma.projectReportAudit.create({
          data: {
            reportId: savedReport.id,
            action: `DEMAND_${status}`,
            changedById: user?.id ? Number(user.id) : null,
            changedByName: reviewerLabel,
            version: savedReport.version || 1,
            comment: `Admin marked ${updatedDemand.type === 'PAYMENT' ? 'Payment' : 'Material'} Demand (Rs. ${Number(updatedDemand.amount || 0).toLocaleString()}) as ${status}`,
          },
        })
      ).catch(() => {});

      const refreshedJob = await withDbRetry(() =>
        prisma.jobMetadata.findUnique({
          where: { id: targetReport.jobMetadataId },
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

      const projKey = prevMeta.projectKey || 'manawala';
      const matchedSite =
        FES_PROJECT_SITES.find((s) => s.key === projKey) || {
          key: projKey,
          label: targetReport.branchName || 'Project Site',
          branchName: targetReport.branchName || 'Project Site',
        };

      return NextResponse.json({
        demand: {
          ...updatedDemand,
          jobMetadataId: targetReport.jobMetadataId,
          reportId: savedReport.id,
        },
        project: formatProjectPayload(matchedSite, refreshedJob),
        success: true,
      });
    }

    return NextResponse.json({ error: 'Invalid PATCH action' }, { status: 400 });
  } catch (error) {
    console.error('PATCH /api/field-projects error:', error);
    return NextResponse.json(
      { error: 'Failed to process demand action: ' + error.message },
      { status: 500 }
    );
  }
}
