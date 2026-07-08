import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobMetadataId = searchParams.get('jobMetadataId');

    const where = jobMetadataId ? { jobMetadataId: Number(jobMetadataId) } : undefined;

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, employeeName: true, email: true } },
        jobMetadata: {
          include: { ticket: true },
        },
      },
    });

    return NextResponse.json({ expenses });
  } catch (error) {
    console.error('Expenses fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { jobMetadataId, amount, imageUrl, summaryNotes } = await request.json();
    const authCookie = request.headers.get('x-user-id') || request.cookies.get('nexus_user')?.value;
    let userId = null;
    if (authCookie) {
      try {
        let parsed = null;
        if (typeof authCookie === 'string') {
          const decoded = decodeURIComponent(authCookie);
          if (decoded.startsWith('{')) {
            parsed = JSON.parse(decoded);
          } else {
            parsed = { id: decoded };
          }
        }
        const parsedId = parsed?.id ? Number(parsed.id) : null;
        userId = (parsedId && !isNaN(parsedId)) ? parsedId : null;
      } catch {}
    }

    if (!jobMetadataId || amount === undefined || !summaryNotes) {
      return NextResponse.json({ error: 'jobMetadataId, amount, and summaryNotes are required' }, { status: 400 });
    }

    try {
      const expense = await prisma.expense.create({
        data: {
          jobMetadataId: Number(jobMetadataId),
          amount: Number(amount),
          imageUrl: imageUrl || null,
          summaryNotes,
          createdById: userId,
        },
        include: {
          createdBy: { select: { id: true, employeeName: true, email: true } },
          jobMetadata: { include: { ticket: true } },
        },
      });
      return NextResponse.json({ expense }, { status: 201 });
    } catch (e) {
      const expense = await prisma.expense.create({
        data: {
          jobMetadataId: Number(jobMetadataId),
          amount: Number(amount),
          imageUrl: imageUrl || null,
          summaryNotes,
        },
        include: {
          jobMetadata: { include: { ticket: true } },
        },
      });
      return NextResponse.json({ expense }, { status: 201 });
    }
  } catch (error) {
    console.error('Expense create error:', error);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}
