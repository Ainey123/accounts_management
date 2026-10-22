import { NextResponse } from 'next/server';
import { prisma, withDbRetry } from '@/lib/prisma';

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

export async function GET(request, context) {
  try {
    const user = getUserFromCookie(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const id = Number(params?.id);
    if (!id || isNaN(id)) {
      return NextResponse.json({ error: 'Valid Report ID is required' }, { status: 400 });
    }

    const report = await withDbRetry(async () => {
      return await prisma.projectReportSubmission.findUnique({
        where: { id },
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

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Role check: field employees can only access their own reports
    if (user.role === 'FIELD_EMPLOYEE' && report.employeeId !== Number(user.id)) {
      return NextResponse.json({ error: 'Access denied to this report' }, { status: 403 });
    }

    return NextResponse.json({ report, success: true });
  } catch (error) {
    console.error('Fetch single report error:', error);
    return NextResponse.json({ error: 'Failed to fetch report: ' + error.message }, { status: 500 });
  }
}

export async function PATCH(request, context) {
  try {
    const user = getUserFromCookie(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const id = Number(params?.id);
    if (!id || isNaN(id)) {
      return NextResponse.json({ error: 'Valid Report ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const {
      status, // 'APPROVED', 'CORRECTION_REQUIRED', 'SUBMITTED', 'UNDER_REVIEW'
      reviewerNotes,
      expenseData,
      progressData,
      totalExpenseAmount,
      overallProgressPercent,
      attachments,
      paidBy,
    } = body;

    const existing = await prisma.projectReportSubmission.findUnique({
      where: { id },
      include: { jobMetadata: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const userId = Number(user.id);
    const userName = user.employeeName || user.email || 'User';

    // ── OFFICE REVIEW / APPROVAL / CORRECTION WORKFLOW ───────────────────────
    if (status === 'APPROVED' || status === 'CORRECTION_REQUIRED' || status === 'UNDER_REVIEW') {
      if (user.role === 'FIELD_EMPLOYEE') {
        return NextResponse.json({ error: 'Field employees cannot approve or review reports.' }, { status: 403 });
      }

      const updated = await prisma.projectReportSubmission.update({
        where: { id },
        data: {
          status,
          reviewerNotes: reviewerNotes || existing.reviewerNotes,
          reviewedById: userId || null,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        },
        include: {
          employee: { select: { id: true, employeeName: true } },
          jobMetadata: { include: { ticket: true } },
          linkedExpense: true,
        },
      });

      // Audit trail entry
      const auditAction = status === 'APPROVED' ? 'APPROVED' : status === 'CORRECTION_REQUIRED' ? 'CORRECTION_REQUESTED' : 'REVIEW_STARTED';
      await prisma.projectReportAudit.create({
        data: {
          reportId: id,
          action: auditAction,
          changedById: userId || null,
          changedByName: userName,
          version: existing.version,
          comment: reviewerNotes || `Status changed to ${status}`,
        },
      });

      return NextResponse.json({ report: updated, success: true });
    }

    // ── FIELD EMPLOYEE CORRECTION / RESUBMISSION WORKFLOW ────────────────────
    if (status === 'SUBMITTED') {
      // Must be owner if field employee
      if (user.role === 'FIELD_EMPLOYEE' && existing.employeeId !== userId) {
        return NextResponse.json({ error: 'Unauthorized to modify this report' }, { status: 403 });
      }

      const nextVersion = existing.version + 1;
      const finalExpenseData = expenseData !== undefined ? (typeof expenseData === 'string' ? expenseData : JSON.stringify(expenseData)) : existing.expenseData;
      const finalProgressData = progressData !== undefined ? (typeof progressData === 'string' ? progressData : JSON.stringify(progressData)) : existing.progressData;
      const finalAttachments = attachments !== undefined ? (typeof attachments === 'string' ? attachments : JSON.stringify(attachments)) : existing.attachments;
      const finalTotal = totalExpenseAmount !== undefined ? (parseFloat(totalExpenseAmount) || 0) : existing.totalExpenseAmount;
      const finalProgressPct = overallProgressPercent !== undefined ? (parseFloat(overallProgressPercent) || 0) : existing.overallProgressPercent;
      const finalPaidBy = paidBy || existing.paidBy;

      const updated = await prisma.projectReportSubmission.update({
        where: { id },
        data: {
          status: 'SUBMITTED',
          version: nextVersion,
          expenseData: finalExpenseData,
          progressData: finalProgressData,
          attachments: finalAttachments,
          totalExpenseAmount: finalTotal,
          overallProgressPercent: finalProgressPct,
          paidBy: finalPaidBy,
          updatedAt: new Date(),
        },
        include: {
          employee: { select: { id: true, employeeName: true } },
          jobMetadata: { include: { ticket: true } },
          linkedExpense: true,
        },
      });

      // Update or create linked Expense in Operations Feed
      if (finalTotal > 0) {
        if (existing.linkedExpenseId) {
          await prisma.expense.update({
            where: { id: existing.linkedExpenseId },
            data: {
              amount: finalTotal,
              paidBy: finalPaidBy,
              summaryNotes: `[Field Work] [Project Report #${id} v${nextVersion}] ${existing.branchName || ''} - Grand Total: Rs. ${finalTotal.toLocaleString()}`,
            },
          }).catch(() => {});
        } else {
          const newExpense = await prisma.expense.create({
            data: {
              jobMetadataId: existing.jobMetadataId,
              amount: finalTotal,
              imageUrl: getFirstAttachment(finalAttachments),
              summaryNotes: `[Field Work] [Project Report #${id} v${nextVersion}] ${existing.branchName || ''} - Grand Total: Rs. ${finalTotal.toLocaleString()}`,
              category: 'Site Expense',
              expenseDate: existing.reportDate || new Date(),
              createdById: userId,
              paidBy: finalPaidBy,
            },
          });
          await prisma.projectReportSubmission.update({
            where: { id },
            data: { linkedExpenseId: newExpense.id },
          });
        }
      }

      // Record in audit log
      await prisma.projectReportAudit.create({
        data: {
          reportId: id,
          action: 'RESUBMITTED',
          changedById: userId,
          changedByName: userName,
          version: nextVersion,
          comment: `Resubmitted v${nextVersion} by field employee with updated expenses and progress data`,
        },
      });

      return NextResponse.json({ report: updated, success: true });
    }

    return NextResponse.json({ error: 'Invalid update action or status' }, { status: 400 });
  } catch (error) {
    console.error('Update report error:', error);
    return NextResponse.json({ error: 'Failed to update report: ' + error.message }, { status: 500 });
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
