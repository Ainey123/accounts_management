import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobMetadataId = searchParams.get('jobMetadataId');

    const where = jobMetadataId ? { jobMetadataId: Number(jobMetadataId) } : undefined;

    const payments = await prisma.paymentReceived.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, employeeName: true, email: true } },
        jobMetadata: {
          include: { ticket: true },
        },
      },
    });

    return NextResponse.json({ payments });
  } catch (error) {
    console.error('Payments fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { jobMetadataId, amount, taxDeducted, imageUrl, summaryNotes } = await request.json();
    const authCookie = request.headers.get('x-user-id') || request.cookies.get('nexus_user')?.value;
    let userId = null;
    if (authCookie) {
      try {
        const decoded = typeof authCookie === 'string' ? decodeURIComponent(authCookie) : authCookie;
        const parsed = decoded.startsWith('{') ? JSON.parse(decoded) : null;
        userId = parsed?.id || null;
      } catch {}
    }

    if (!jobMetadataId || amount === undefined || !summaryNotes) {
      return NextResponse.json({ error: 'jobMetadataId, amount, and summaryNotes are required' }, { status: 400 });
    }

    try {
      const payment = await prisma.paymentReceived.create({
        data: {
          jobMetadataId: Number(jobMetadataId),
          amount: Number(amount),
          taxDeducted: taxDeducted ? Number(taxDeducted) : 0,
          imageUrl: imageUrl || null,
          summaryNotes,
          createdById: userId,
        },
        include: {
          createdBy: { select: { id: true, employeeName: true, email: true } },
          jobMetadata: { include: { ticket: true } },
        },
      });
      return NextResponse.json({ payment }, { status: 201 });
    } catch (e) {
      const payment = await prisma.paymentReceived.create({
        data: {
          jobMetadataId: Number(jobMetadataId),
          amount: Number(amount),
          taxDeducted: taxDeducted ? Number(taxDeducted) : 0,
          imageUrl: imageUrl || null,
          summaryNotes,
        },
        include: {
          jobMetadata: { include: { ticket: true } },
        },
      });
      return NextResponse.json({ payment }, { status: 201 });
    }
  } catch (error) {
    console.error('Payment create error:', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}
