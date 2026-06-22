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
    });

    return NextResponse.json({ report });
  } catch (error) {
    console.error('Survey fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch survey report' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { jobMetadataId, reportText } = await request.json();

    if (!jobMetadataId || reportText === undefined) {
      return NextResponse.json({ error: 'jobMetadataId and reportText are required' }, { status: 400 });
    }

    const report = await prisma.surveyReport.upsert({
      where: { jobMetadataId: Number(jobMetadataId) },
      create: { jobMetadataId: Number(jobMetadataId), reportText },
      update: { reportText },
    });

    return NextResponse.json({ report });
  } catch (error) {
    console.error('Survey save error:', error);
    return NextResponse.json({ error: 'Failed to save survey report' }, { status: 500 });
  }
}
