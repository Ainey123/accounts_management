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

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      invoiceId,
      jobId,
      settlementDate,
      amountPaid,
      paymentMethod = 'Bank Transfer',
      notes = '',
      imageUrl = null,
      isFullClearance = true,
    } = body;

    const sessionUser = getUserFromCookie(request);
    if (sessionUser && sessionUser.role === 'EMPLOYEE') {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin access required' }, { status: 403 });
    }
    const userId = sessionUser?.id ? Number(sessionUser.id) : null;

    if (!invoiceId && !jobId) {
      return NextResponse.json({ error: 'Either invoiceId or jobId is required' }, { status: 400 });
    }

    const result = await withDbRetry(async () => {
      let targetJobId = jobId ? Number(jobId) : null;
      let targetInvoiceId = invoiceId ? Number(invoiceId) : null;

      if (targetInvoiceId && !targetJobId) {
        const inv = await prisma.quotationInvoice.findUnique({
          where: { id: targetInvoiceId },
          select: { id: true, jobMetadataId: true },
        });
        if (inv) {
          targetJobId = inv.jobMetadataId;
        }
      }

      if (!targetJobId && targetInvoiceId) {
        throw new Error('Linked job not found for this invoice');
      }

      const dateObj = settlementDate ? new Date(settlementDate) : new Date();

      // 1. Record payment in PaymentReceived if amount was provided
      let createdPayment = null;
      if (amountPaid && Number(amountPaid) > 0) {
        createdPayment = await prisma.paymentReceived.create({
          data: {
            jobMetadataId: targetJobId,
            amount: Number(amountPaid),
            summaryNotes: notes || `Settled via ${paymentMethod} (${settlementDate || 'Current Date'})`,
            imageUrl: imageUrl || null,
            createdAt: dateObj,
            createdById: userId,
          },
        }).catch(async (e) => {
          // Fallback if createdById foreign key fails
          return await prisma.paymentReceived.create({
            data: {
              jobMetadataId: targetJobId,
              amount: Number(amountPaid),
              summaryNotes: notes || `Settled via ${paymentMethod}`,
              imageUrl: imageUrl || null,
              createdAt: dateObj,
            },
          });
        });
      }

      // 2. Update JobMetadata payment status and progress
      const newStatus = isFullClearance ? 'CLEARED' : 'PARTIALLY_PAID';
      const newProgress = isFullClearance ? 100 : 50;

      await prisma.jobMetadata.update({
        where: { id: targetJobId },
        data: {
          paymentStatus: newStatus,
          paymentProgress: newProgress,
          updatedAt: dateObj,
        },
      }).catch((e) => {
        console.warn('Could not update jobMetadata payment status:', e.message);
      });

      // 3. Update QuotationInvoice status if invoice exists
      if (targetInvoiceId) {
        await prisma.quotationInvoice.update({
          where: { id: targetInvoiceId },
          data: {
            status: newStatus,
            updatedAt: dateObj,
          },
        }).catch((e) => {
          console.warn('Could not update quotationInvoice status:', e.message);
        });
      } else {
        // Also update any invoice linked to this job
        await prisma.quotationInvoice.updateMany({
          where: { jobMetadataId: targetJobId, documentType: 'INVOICE' },
          data: {
            status: newStatus,
            updatedAt: dateObj,
          },
        }).catch(() => {});
      }

      return { success: true, newStatus, createdPayment };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error settling payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to settle payment' },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { invoiceId, jobId, action = 'reopen' } = body;

    const result = await withDbRetry(async () => {
      let targetJobId = jobId ? Number(jobId) : null;
      let targetInvoiceId = invoiceId ? Number(invoiceId) : null;

      if (targetInvoiceId && !targetJobId) {
        const inv = await prisma.quotationInvoice.findUnique({
          where: { id: targetInvoiceId },
          select: { id: true, jobMetadataId: true },
        });
        if (inv) targetJobId = inv.jobMetadataId;
      }

      const status = action === 'reopen' ? 'PENDING' : 'CLEARED';
      const progress = action === 'reopen' ? 0 : 100;

      if (targetJobId) {
        await prisma.jobMetadata.update({
          where: { id: targetJobId },
          data: { paymentStatus: status, paymentProgress: progress },
        }).catch(() => {});
      }

      if (targetInvoiceId) {
        await prisma.quotationInvoice.update({
          where: { id: targetInvoiceId },
          data: { status },
        }).catch(() => {});
      }

      return { success: true, status };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating payment status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update status' },
      { status: 500 }
    );
  }
}
