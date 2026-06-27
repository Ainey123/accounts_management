import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobMetadataId = searchParams.get('jobMetadataId');

    if (!jobMetadataId) {
      return NextResponse.json({ error: 'jobMetadataId is required' }, { status: 400 });
    }

    const report = await prisma.surveyReport.findUnique({
      where: { jobMetadataId: Number(jobMetadataId) },
      include: { createdBy: { select: { id: true, employeeName: true, email: true } } },
    });

    return NextResponse.json({ report });
  } catch (error) {
    console.error('Survey fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch survey report' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { jobMetadataId, reportText, imageUrl } = await request.json();
    const authCookie = request.headers.get('x-user-id') || request.cookies.get('nexus_user')?.value;
    let userId = null;
    if (authCookie) {
      try {
        const parsed = typeof authCookie === 'string' && authCookie.startsWith('{') ? JSON.parse(authCookie) : null;
        userId = parsed?.id || null;
      } catch {}
    }

    if (!jobMetadataId || reportText === undefined) {
      return NextResponse.json({ error: 'jobMetadataId and reportText are required' }, { status: 400 });
    }

    try {
      const report = await prisma.surveyReport.upsert({
        where: { jobMetadataId: Number(jobMetadataId) },
        create: { jobMetadataId: Number(jobMetadataId), reportText, imageUrl: imageUrl || null, createdById: userId },
        update: { reportText, imageUrl: imageUrl || null, createdById: userId },
      });
      return NextResponse.json({ report });
    } catch (e) {
      const report = await prisma.surveyReport.upsert({
        where: { jobMetadataId: Number(jobMetadataId) },
        create: { jobMetadataId: Number(jobMetadataId), reportText, imageUrl: imageUrl || null },
        update: { reportText, imageUrl: imageUrl || null },
      });
      return NextResponse.json({ report });
    }
  } catch (error) {
    console.error('Survey save error:', error);
    return NextResponse.json({ error: 'Failed to save survey report' }, { status: 500 });
  }
}
