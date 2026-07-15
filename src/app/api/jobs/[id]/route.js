import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const ALLOWED_PAYMENT_STATUSES = ['PENDING', 'PARTIAL', 'PAID'];

export async function PATCH(request, context) {
  try {
    // In Next.js 15+, params must be awaited
    const params = await context.params;
    const id = Number(params?.id);
    if (!id || isNaN(id)) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const data = {};

    if (body.paymentStatus !== undefined) {
      if (!ALLOWED_PAYMENT_STATUSES.includes(body.paymentStatus)) {
        return NextResponse.json({ error: 'Invalid payment status. Must be PENDING, PARTIAL, or PAID' }, { status: 400 });
      }
      data.paymentStatus = body.paymentStatus;
    }

    if (body.activeStatus !== undefined) {
      data.activeStatus = Boolean(body.activeStatus);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const job = await prisma.jobMetadata.update({
      where: { id },
      data,
      include: {
        ticket: { select: { id: true, serialNo: true, subject: true } },
      },
    });

    return NextResponse.json({ job });
  } catch (error) {
    console.error('Job update error:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update job', details: error.message }, { status: 500 });
  }
}