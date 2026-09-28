import { NextResponse } from 'next/server';
import { prisma, withDbRetry } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobMetadataId = searchParams.get('jobMetadataId');

    const where = jobMetadataId ? { jobMetadataId: Number(jobMetadataId) } : undefined;

    const expenses = await withDbRetry(async () => {
      return await prisma.expense.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, employeeName: true, email: true } },
          jobMetadata: {
            include: {
              ticket: true,
              assignedEmployee: { select: { id: true, employeeName: true, email: true } },
            },
          },
          bankTransaction: {
            include: {
              statement: { select: { id: true, bankName: true, fileName: true } },
            },
          },
        },
      });
    });

    return NextResponse.json({ expenses, success: true });
  } catch (error) {
    console.error('Expenses fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch expenses: ' + error.message }, { status: 500 });
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

    const expense = await withDbRetry(async () => {
      return await prisma.expense.create({
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
    });

    return NextResponse.json({ expense, success: true }, { status: 201 });
  } catch (error) {
    console.error('Expense create error:', error);
    return NextResponse.json({ error: 'Failed to create expense: ' + error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const {
      id,
      amount,
      category,
      summaryNotes,
      expenseDate,
      imageUrl,
      status,
      adjustedAmount,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Expense ID is required for editing' }, { status: 400 });
    }

    const updateData = {};
    if (amount !== undefined && !isNaN(Number(amount))) {
      updateData.amount = Number(amount);
    }
    if (category !== undefined) {
      updateData.category = category;
    }
    if (summaryNotes !== undefined) {
      updateData.summaryNotes = summaryNotes;
    }
    if (imageUrl !== undefined) {
      updateData.imageUrl = imageUrl || null;
    }
    if (expenseDate !== undefined) {
      const pDate = new Date(expenseDate);
      if (!isNaN(pDate.getTime())) {
        updateData.expenseDate = pDate;
      }
    }
    if (status !== undefined) {
      updateData.status = status;
    }
    if (adjustedAmount !== undefined && !isNaN(Number(adjustedAmount))) {
      updateData.adjustedAmount = Number(adjustedAmount);
    }

    const updated = await withDbRetry(async () => {
      return await prisma.expense.update({
        where: { id: Number(id) },
        data: updateData,
        include: {
          createdBy: { select: { id: true, employeeName: true, email: true } },
          jobMetadata: {
            include: {
              ticket: true,
              assignedEmployee: { select: { id: true, employeeName: true, email: true } },
            },
          },
          bankTransaction: {
            include: {
              statement: { select: { id: true, bankName: true, fileName: true } },
            },
          },
        },
      });
    });

    return NextResponse.json({ expense: updated, success: true });
  } catch (error) {
    console.error('Expense update error:', error);
    return NextResponse.json({ error: 'Failed to update expense: ' + error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await request.json();
        id = body?.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ error: 'Expense ID is required for deletion' }, { status: 400 });
    }

    const expenseId = Number(id);

    await withDbRetry(async () => {
      // If linked to a bank transaction, reset transaction status
      const existing = await prisma.expense.findUnique({
        where: { id: expenseId },
        select: { bankTransactionId: true, adjustedAmount: true },
      });

      if (existing?.bankTransactionId) {
        await prisma.bankTransaction.update({
          where: { id: existing.bankTransactionId },
          data: {
            matchStatus: 'UNMATCHED',
            reconciledAmount: { decrement: existing.adjustedAmount || 0 },
          },
        }).catch(() => {});
      }

      await prisma.expense.delete({
        where: { id: expenseId },
      });
    });

    return NextResponse.json({ success: true, deletedId: expenseId, message: `Expense #${expenseId} deleted successfully.` });
  } catch (error) {
    console.error('Expense delete error:', error);
    return NextResponse.json({ error: 'Failed to delete expense: ' + error.message }, { status: 500 });
  }
}
