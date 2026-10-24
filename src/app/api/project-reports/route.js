import { NextResponse } from 'next/server';
import { prisma, withDbRetry } from '@/lib/prisma';
import { nextTicketSerialNo } from '@/lib/serial';

export const dynamic = 'force-dynamic';

function getUserFromCookie(request) {
  const authCookie = request.headers.get('x-user-id') || request.cookies.get('nexus_user')?.value;
  if (!authCookie) return null;
  try {
    const decoded = typeof authCookie === 'string' ? decodeURIComponent(authCookie) : authCookie;
    return decoded.startsWith('{') ? JSON.parse(decoded) : null;
  } catch {
    return null;
  }
}

/**
 * GET /api/project-reports
 * Query params: jobMetadataId, status, myReports
 */
export async function GET(request) {
  try {
    const user = getUserFromCookie(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jobMetadataId = searchParams.get('jobMetadataId');
    const statusParam = searchParams.get('status');
    const myReports = searchParams.get('myReports') === 'true';

    let where = {};

    if (user.role === 'FIELD_EMPLOYEE') {
      // Strict role-based isolation: field employees can ONLY view reports for their own assigned jobs or created by them
      const empId = Number(user.id);
      if (!empId) {
        return NextResponse.json({ reports: [] });
      }
      where = {
        OR: [
          { employeeId: empId },
          { jobMetadata: { assignedEmployeeId: empId } },
        ],
      };
      if (jobMetadataId) {
        where.jobMetadataId = Number(jobMetadataId);
      }
    } else {
      // Office employee or Admin
      if (jobMetadataId) {
        where.jobMetadataId = Number(jobMetadataId);
      }
      if (myReports && user.id) {
        where.jobMetadata = {
          OR: [
            { createdById: Number(user.id) },
            { assignedEmployeeId: Number(user.id) },
          ],
        };
      }
    }

    if (statusParam) {
      where.status = statusParam;
    }

    const reports = await withDbRetry(async () => {
      return await prisma.projectReportSubmission.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        include: {
          employee: { select: { id: true, employeeName: true, email: true } },
          reviewedBy: { select: { id: true, employeeName: true, email: true } },
          jobMetadata: {
            include: {
              ticket: true,
              assignedEmployee: { select: { id: true, employeeName: true } },
              createdBy: { select: { id: true, employeeName: true } },
            },
          },
          linkedExpense: true,
          audits: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    });

    return NextResponse.json({ reports, success: true });
  } catch (error) {
    console.error('Project reports fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch project reports: ' + error.message }, { status: 500 });
  }
}

/**
 * POST /api/project-reports
 * Create a new submission or draft
 */
export async function POST(request) {
  try {
    const user = getUserFromCookie(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const {
      jobMetadataId,
      branchName,
      reportDate,
      expenseData,
      progressData,
      totalExpenseAmount = 0,
      overallProgressPercent = 0,
      attachments = '[]',
      paidBy = 'FES',
      status = 'SUBMITTED', // 'SUBMITTED' or 'IN_PROGRESS'
    } = body;

    const employeeId = Number(user.id);
    let job = null;
    let finalJobId = jobMetadataId ? Number(jobMetadataId) : null;

    if (finalJobId && !isNaN(finalJobId)) {
      job = await prisma.jobMetadata.findUnique({
        where: { id: finalJobId },
        include: { ticket: true },
      });
    }

    if (!job) {
      // Auto-create ticket & jobMetadata so submitting project report never fails
      const serialNo = await nextTicketSerialNo();
      const client = body.clientName?.trim() || 'General Client';
      const branch = branchName?.trim() || 'Site Project';
      const poc = body.personOfContact?.trim() || user?.employeeName || 'Site Contact';
      
      const newTicket = await prisma.ticket.create({
        data: {
          serialNo,
          subject: `${client} - ${branch} (PROJECT)`,
          sender: user?.employeeName || 'Field Site Entry',
          exactDate: new Date(),
          time: new Date().toTimeString().slice(0, 5),
          status: 'RELEVANT',
          statusLastChangedBy: user?.employeeName || 'Field Portal',
          createdById: employeeId,
        },
      });

      job = await prisma.jobMetadata.create({
        data: {
          ticketId: newTicket.id,
          clientName: client,
          branchName: branch,
          personOfContact: poc,
          workNature: 'PROJECT',
          assignedEmployeeId: employeeId,
          manualEnteredBy: user?.employeeName || 'Field Tech',
          createdById: employeeId,
        },
        include: { ticket: true },
      });
      finalJobId = job.id;
    } else if (user.role === 'FIELD_EMPLOYEE' && job.assignedEmployeeId && job.assignedEmployeeId !== employeeId) {
      return NextResponse.json({ error: 'You are only authorized to submit reports for jobs assigned to you.' }, { status: 403 });
    } else if (!job.assignedEmployeeId) {
      // Assign unassigned job to this employee
      await prisma.jobMetadata.update({
        where: { id: job.id },
        data: { assignedEmployeeId: employeeId },
      });
    }

    const finalExpenseData = typeof expenseData === 'string' ? expenseData : JSON.stringify(expenseData || []);
    const finalProgressData = typeof progressData === 'string' ? progressData : JSON.stringify(progressData || []);
    const finalAttachments = typeof attachments === 'string' ? attachments : JSON.stringify(attachments || []);
    const finalTotalExpense = parseFloat(totalExpenseAmount) || 0;
    const finalProgressPct = parseFloat(overallProgressPercent) || 0;

    // Idempotency check: prevent duplicate submissions within 5 seconds
    const recentSubmission = await prisma.projectReportSubmission.findFirst({
      where: {
        jobMetadataId: Number(finalJobId),
        employeeId: employeeId,
        createdAt: { gte: new Date(Date.now() - 5000) },
      },
    });

    if (recentSubmission && status === 'SUBMITTED') {
      return NextResponse.json({
        report: recentSubmission,
        message: 'Duplicate submission prevented. Your report was already received.',
      });
    }

    // Check if an open/in-progress submission already exists for this job and employee
    const existingDraft = await prisma.projectReportSubmission.findFirst({
      where: {
        jobMetadataId: Number(finalJobId),
        employeeId: employeeId,
        status: { in: ['IN_PROGRESS', 'CORRECTION_REQUIRED'] },
      },
      orderBy: { id: 'desc' },
    });

    let report;
    let linkedExpense = null;

    if (existingDraft) {
      const nextVersion = status === 'SUBMITTED' ? existingDraft.version + 1 : existingDraft.version;
      report = await prisma.projectReportSubmission.update({
        where: { id: existingDraft.id },
        data: {
          branchName: branchName || job.branchName,
          reportDate: reportDate ? new Date(reportDate) : new Date(),
          version: nextVersion,
          expenseData: finalExpenseData,
          progressData: finalProgressData,
          totalExpenseAmount: finalTotalExpense,
          overallProgressPercent: finalProgressPct,
          attachments: finalAttachments,
          paidBy,
          status,
          updatedAt: new Date(),
        },
      });

      // Audit trail
      await prisma.projectReportAudit.create({
        data: {
          reportId: report.id,
          action: status === 'SUBMITTED' ? 'RESUBMITTED' : 'DRAFT_SAVED',
          changedById: employeeId,
          changedByName: user.employeeName || user.email || 'Employee',
          version: nextVersion,
          comment: status === 'SUBMITTED' ? `Resubmitted version ${nextVersion} by field employee` : 'Draft updated',
        },
      });

      // Sync linked expense if submitted
      if (status === 'SUBMITTED' && finalTotalExpense > 0) {
        if (report.linkedExpenseId) {
          await prisma.expense.update({
            where: { id: report.linkedExpenseId },
            data: {
              amount: finalTotalExpense,
              paidBy,
              summaryNotes: `[Field Work] [Project Report #${report.id} v${nextVersion}] ${branchName || job.branchName} - Grand Total: Rs. ${finalTotalExpense.toLocaleString()}`,
              imageUrl: getFirstAttachment(finalAttachments),
            },
          }).catch(() => {});
        } else {
          linkedExpense = await prisma.expense.create({
            data: {
              jobMetadataId: Number(finalJobId),
              amount: finalTotalExpense,
              imageUrl: getFirstAttachment(finalAttachments),
              summaryNotes: `[Field Work] [Project Report #${report.id} v${nextVersion}] ${branchName || job.branchName} - Grand Total: Rs. ${finalTotalExpense.toLocaleString()}`,
              category: 'Site Expense',
              expenseDate: reportDate ? new Date(reportDate) : new Date(),
              createdById: employeeId,
              paidBy,
            },
          });
          await prisma.projectReportSubmission.update({
            where: { id: report.id },
            data: { linkedExpenseId: linkedExpense.id },
          });
        }
      }
    } else {
      // Create new submission
      report = await prisma.projectReportSubmission.create({
        data: {
          jobMetadataId: Number(finalJobId),
          employeeId: employeeId,
          status,
          branchName: branchName || job.branchName,
          reportDate: reportDate ? new Date(reportDate) : new Date(),
          version: 1,
          expenseData: finalExpenseData,
          progressData: finalProgressData,
          totalExpenseAmount: finalTotalExpense,
          overallProgressPercent: finalProgressPct,
          attachments: finalAttachments,
          paidBy,
        },
      });

      // Audit trail
      await prisma.projectReportAudit.create({
        data: {
          reportId: report.id,
          action: status === 'SUBMITTED' ? 'SUBMITTED' : 'DRAFT_SAVED',
          changedById: employeeId,
          changedByName: user.employeeName || user.email || 'Employee',
          version: 1,
          comment: status === 'SUBMITTED' ? 'Initial submission by field employee' : 'Initial draft saved',
        },
      });

      // Automatically register expense in Operations Feed if submitted
      if (status === 'SUBMITTED' && finalTotalExpense > 0) {
        linkedExpense = await prisma.expense.create({
          data: {
            jobMetadataId: Number(finalJobId),
            amount: finalTotalExpense,
            imageUrl: getFirstAttachment(finalAttachments),
            summaryNotes: `[Field Work] [Project Report #${report.id} v1] ${branchName || job.branchName} - Grand Total: Rs. ${finalTotalExpense.toLocaleString()}`,
            category: 'Site Expense',
            expenseDate: reportDate ? new Date(reportDate) : new Date(),
            createdById: employeeId,
            paidBy,
          },
        });

        await prisma.projectReportSubmission.update({
          where: { id: report.id },
          data: { linkedExpenseId: linkedExpense.id },
        });
      }
    }

    return NextResponse.json({ report, success: true }, { status: 201 });
  } catch (error) {
    console.error('Project report submission error:', error);
    return NextResponse.json({ error: 'Failed to submit report: ' + error.message }, { status: 500 });
  }
}

function getFirstAttachment(attachmentsJson) {
  try {
    const list = JSON.parse(attachmentsJson);
    if (Array.isArray(list) && list.length > 0) {
      return typeof list[0] === 'string' ? list[0] : list[0].url || list[0].data || null;
    }
  } catch {}
  return null;
}
