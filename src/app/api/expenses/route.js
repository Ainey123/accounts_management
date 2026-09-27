import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

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
    const body = await request.json();
    const {
      jobMetadataId,
      amount,
      imageUrl,
      summaryNotes = '',
      category = 'Site Expense',
      expenseDate,
      expenseTime,
      billId,
      billNumber,
      bankReceiptId,
      bankSlipNo,
      bankName,
      accountName,
      personName,
    } = body;

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

    const finalAmount = amount !== undefined && amount !== null && !isNaN(Number(amount)) ? Number(amount) : 0;

    // Build rich, structured metadata tags
    const notesPrefixParts = [];
    if (billId || billNumber) notesPrefixParts.push(`[${billId || `Bill ${billNumber}`}]`);
    if (bankReceiptId) notesPrefixParts.push(`[Bank Receipt ID: ${bankReceiptId}]`);
    if (bankName) notesPrefixParts.push(`[Bank: ${bankName}]`);
    if (bankSlipNo) notesPrefixParts.push(`[Slip/Ref: ${bankSlipNo}]`);
    if (accountName) notesPrefixParts.push(`[Account: ${accountName}]`);
    if (personName) notesPrefixParts.push(`[Person: ${personName}]`);
    if (expenseTime) notesPrefixParts.push(`[Time: ${expenseTime}]`);
    if (category && category !== 'Site Expense') notesPrefixParts.push(`[${category}]`);

    const prefixStr = notesPrefixParts.join(' ');
    const finalSummaryNotes = prefixStr
      ? `${prefixStr} ${summaryNotes || ''}`.trim()
      : (summaryNotes || 'Site Expense claim');

    // Parse date with time if provided
    let parsedDate = new Date();
    if (expenseDate) {
      if (expenseTime) {
        parsedDate = new Date(`${expenseDate}T${expenseTime}:00`);
        if (isNaN(parsedDate.getTime())) {
          parsedDate = new Date(expenseDate);
        }
      } else {
        parsedDate = new Date(expenseDate);
      }
    }

    const expense = await prisma.expense.create({
      data: {
        jobMetadataId: Number(jobMetadataId),
        amount: finalAmount,
        imageUrl: imageUrl || null,
        summaryNotes: finalSummaryNotes,
        category: category || 'Site Expense',
        expenseDate: parsedDate,
        createdById: userId,
      },
      include: {
        createdBy: { select: { id: true, employeeName: true, email: true } },
        jobMetadata: { include: { ticket: true } },
      },
    });

    return NextResponse.json({ expense, success: true }, { status: 201 });
  } catch (error) {
    console.error('Expense create error:', error);
    return NextResponse.json({ error: 'Failed to create expense: ' + error.message }, { status: 500 });
  }
}
