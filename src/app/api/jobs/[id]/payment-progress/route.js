import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(request, context) {
  try {
    const { paymentProgress } = await request.json();
    const params = await context.params;
    const jobId = Number(params.id);

    if (typeof paymentProgress !== 'number' || paymentProgress < 0 || paymentProgress > 100) {
      return NextResponse.json({ error: 'Payment progress must be between 0 and 100' }, { status: 400 });
    }

    const job = await prisma.jobMetadata.findUnique({
      where: { id: jobId },
      include: { ticket: true },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const updated = await prisma.jobMetadata.update({
      where: { id: jobId },
      data: { paymentProgress },
      include: { ticket: true },
    });

    return NextResponse.json({ success: true, job: updated });
  } catch (error) {
    console.error('Update payment progress error:', error);
    return NextResponse.json({ error: 'Failed to update payment progress' }, { status: 500 });
  }
}