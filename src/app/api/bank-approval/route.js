import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobMetadataId = searchParams.get('jobMetadataId');

    const where = jobMetadataId ? { jobMetadataId: Number(jobMetadataId) } : undefined;

    const bankApprovals = await prisma.bankApproval.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, employeeName: true, email: true } },
        jobMetadata: {
          include: { ticket: true },
        },
      },
    });

    return NextResponse.json({ bankApprovals });
  } catch (error) {
    console.error('BankApproval fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch bank approvals' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { jobMetadataId, bankName, accountNumber, amount, imageUrl, notes, status } = await request.json();
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

    if (!jobMetadataId) {
      return NextResponse.json({ error: 'jobMetadataId is required' }, { status: 400 });
    }

    // Upsert so there is only one bank approval per job
    const bankApproval = await prisma.bankApproval.upsert({
      where: { jobMetadataId: Number(jobMetadataId) },
      update: {
        bankName: bankName || null,
        accountNumber: accountNumber || null,
        amount: Number(amount) || 0,
        imageUrl: imageUrl || null,
        notes: notes || null,
        status: status || 'PENDING',
      },
      create: {
        jobMetadataId: Number(jobMetadataId),
        bankName: bankName || null,
        accountNumber: accountNumber || null,
        amount: Number(amount) || 0,
        imageUrl: imageUrl || null,
        notes: notes || null,
        status: status || 'PENDING',
        createdById: userId,
      },
      include: {
        createdBy: { select: { id: true, employeeName: true, email: true } },
        jobMetadata: { include: { ticket: true } },
      },
    });

    return NextResponse.json({ bankApproval }, { status: 201 });
  } catch (error) {
    console.error('BankApproval create/update error:', error);
    return NextResponse.json({ error: 'Failed to save bank approval' }, { status: 500 });
  }
}