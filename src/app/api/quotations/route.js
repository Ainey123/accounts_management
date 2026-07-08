import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const STATUSES = ['PENDING', 'APPROVED', 'CANCELLED'];
const DOC_TYPES = ['QUOTATION', 'INVOICE'];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobMetadataId = searchParams.get('jobMetadataId');
    const documentType = searchParams.get('documentType');

    if (!jobMetadataId) {
      return NextResponse.json({ error: 'jobMetadataId is required' }, { status: 400 });
    }

    const where = { jobMetadataId: Number(jobMetadataId) };
    if (documentType) where.documentType = documentType;

    const documents = await prisma.quotationInvoice.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        createdBy: { select: { id: true, employeeName: true, email: true } },
        jobMetadata: {
          include: { ticket: true },
        },
      },
    });

    const parsed = documents.map((doc) => ({
      ...doc,
      lineItems: JSON.parse(doc.lineItems || '[]'),
    }));

    return NextResponse.json({ documents: parsed });
  } catch (error) {
    console.error('Quotation fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { jobMetadataId, documentType = 'QUOTATION', lineItems = [], poNumber, status = 'PENDING', imageUrl } =
      await request.json();
    const authCookie = request.headers.get('x-user-id') || request.cookies.get('nexus_user')?.value;
    let userId = null;
    if (authCookie) {
      try {
        const parsed = typeof authCookie === 'string' && authCookie.startsWith('{') ? JSON.parse(authCookie) : null;
        userId = parsed?.id || null;
      } catch {}
    }

    if (!jobMetadataId) {
      return NextResponse.json({ error: 'jobMetadataId is required' }, { status: 400 });
    }
    if (!DOC_TYPES.includes(documentType)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    if (!STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    try {
      const document = await prisma.quotationInvoice.create({
        data: {
          jobMetadataId: Number(jobMetadataId),
          documentType,
          lineItems: JSON.stringify(lineItems),
          poNumber: poNumber || null,
          status,
          imageUrl: imageUrl || null,
          createdById: userId,
        },
        include: {
          createdBy: { select: { id: true, employeeName: true, email: true } },
          jobMetadata: { include: { ticket: true } },
        },
      });
      return NextResponse.json({ document }, { status: 201 });
    } catch (e) {
      const document = await prisma.quotationInvoice.create({
        data: {
          jobMetadataId: Number(jobMetadataId),
          documentType,
          lineItems: JSON.stringify(lineItems),
          poNumber: poNumber || null,
          status,
          imageUrl: imageUrl || null,
        },
        include: {
          jobMetadata: { include: { ticket: true } },
        },
      });
      return NextResponse.json({ document }, { status: 201 });
    }
  } catch (error) {
    console.error('Quotation create error:', error);
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { id, lineItems, poNumber, status, imageUrl } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Document id is required' }, { status: 400 });
    }
    if (status && !STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const data = {};
    if (lineItems !== undefined) data.lineItems = JSON.stringify(lineItems);
    if (poNumber !== undefined) data.poNumber = poNumber || null;
    if (status !== undefined) data.status = status;
    if (imageUrl !== undefined) data.imageUrl = imageUrl || null;

    const document = await prisma.quotationInvoice.update({
      where: { id: Number(id) },
      data,
      include: {
        createdBy: { select: { id: true, employeeName: true, email: true } },
        jobMetadata: { include: { ticket: true } },
      },
    });

    return NextResponse.json({ document });
  } catch (error) {
    console.error('Quotation update error:', error);
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
  }
}
