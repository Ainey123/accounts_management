import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const ALLOWED_PAYMENT_STATUSES = ['PENDING', 'PARTIAL', 'PAID'];

export async function PATCH(request, { params }) {
  try {
    const id = Number(params.id);
    if (!id) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const data = {};

    if (body.paymentStatus !== undefined) {
      if (!ALLOWED_PAYMENT_STATUSES.includes(body.paymentStatus)) {
        return NextResponse.json({ error: 'Invalid payment status. Must be PENDING, PARTIAL, or PAID' }, { status: 400 });
      }
      data.paymentStatus = body.paymentStatus;
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
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 });
  }
}