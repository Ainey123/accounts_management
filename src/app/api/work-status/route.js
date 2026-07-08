import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobMetadataId = searchParams.get('jobMetadataId');

    const where = jobMetadataId ? { jobMetadataId: Number(jobMetadataId) } : undefined;

    const workCompletions = await prisma.workCompletion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, employeeName: true, email: true } },
        jobMetadata: {
          include: { ticket: true },
        },
      },
    });

    return NextResponse.json({ workCompletions });
  } catch (error) {
    console.error('WorkCompletion fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch work completions' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { jobMetadataId, amount, imageUrl, status, notes } = await request.json();
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

    if (!jobMetadataId || !status) {
      return NextResponse.json({ error: 'jobMetadataId and status are required' }, { status: 400 });
    }

    // Upsert so there is only one status per job
    const workCompletion = await prisma.workCompletion.upsert({
      where: { jobMetadataId: Number(jobMetadataId) },
      update: {
        status,
        amount: Number(amount) || 0,
        imageUrl: imageUrl || null,
        notes: notes || null,
      },
      create: {
        jobMetadataId: Number(jobMetadataId),
        status,
        amount: Number(amount) || 0,
        imageUrl: imageUrl || null,
        notes: notes || null,
        createdById: userId,
      },
      include: {
        createdBy: { select: { id: true, employeeName: true, email: true } },
        jobMetadata: { include: { ticket: true } },
      },
    });

    return NextResponse.json({ workCompletion }, { status: 201 });
  } catch (error) {
    console.error('WorkCompletion create/update error:', error);
    return NextResponse.json({ error: 'Failed to update work status' }, { status: 500 });
  }
}
