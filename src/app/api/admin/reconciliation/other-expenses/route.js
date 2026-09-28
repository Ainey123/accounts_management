import { NextResponse } from 'next/server';
import { prisma, withDbRetry } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const category = searchParams.get('category');
    const search = (searchParams.get('search') || '').trim().toLowerCase();

    const where = {};

    if (category && category !== 'all') {
      where.category = category;
    }

    if (month) {
      const start = new Date(`${month}-01T00:00:00.000Z`);
      const [year, m] = month.split('-').map(Number);
      const nextMonth = m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, '0')}`;
      const end = new Date(`${nextMonth}-01T00:00:00.000Z`);
      where.expenseDate = { gte: start, lt: end };
    } else if (startDate || endDate) {
      where.expenseDate = {};
      if (startDate) where.expenseDate.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.expenseDate.lte = end;
      }
    }

    const otherExpenses = await withDbRetry(async () => {
      return await prisma.otherExpense.findMany({
        where,
        orderBy: { expenseDate: 'desc' },
        include: {
          createdBy: { select: { id: true, employeeName: true, email: true } },
        },
      });
    });

    let filtered = otherExpenses;
    if (search) {
      filtered = otherExpenses.filter((o) => {
        const cat = (o.category || '').toLowerCase();
        const paidTo = (o.paidTo || '').toLowerCase();
        const bank = (o.bankName || '').toLowerCase();
        const desc = (o.description || '').toLowerCase();
        const ref = (o.referenceNo || '').toLowerCase();
        const notes = (o.adminNotes || '').toLowerCase();
        const amt = String(o.amount);
        return cat.includes(search) || paidTo.includes(search) || bank.includes(search) || desc.includes(search) || ref.includes(search) || notes.includes(search) || amt.includes(search);
      });
    }

    return NextResponse.json({
      success: true,
      otherExpenses: filtered,
      count: filtered.length,
    });
  } catch (error) {
    console.error('Fetch other expenses error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      expenseDate,
      category,
      amount,
      paidTo,
      bankName,
      paymentMethod,
      description,
      referenceNo,
      attachmentUrl,
      adminNotes,
      adminName = 'Fatma',
    } = body;

    if (!category || !amount || !description) {
      return NextResponse.json({ success: false, error: 'Category, Amount, and Description are required' }, { status: 400 });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Valid positive amount required' }, { status: 400 });
    }

    const otherExpense = await withDbRetry(async () => {
      const created = await prisma.otherExpense.create({
        data: {
          expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
          category: category.trim(),
          amount: numAmount,
          paidTo: (paidTo || 'N/A').trim(),
          bankName: bankName ? bankName.trim() : null,
          paymentMethod: paymentMethod ? paymentMethod.trim() : 'Bank Transfer',
          description: description.trim(),
          referenceNo: referenceNo ? referenceNo.trim() : null,
          attachmentUrl: attachmentUrl || null,
          adminNotes: adminNotes ? adminNotes.trim() : null,
          status: 'RECORDED',
        },
      });

      await prisma.reconciliationAudit.create({
        data: {
          otherExpenseId: created.id,
          adminName,
          action: 'OTHER_EXPENSE_CREATED',
          adjustedAmount: numAmount,
          comment: `Recorded Other Expense: ${category} - Rs. ${numAmount.toLocaleString()} to ${paidTo || 'N/A'} ("${description}")`,
        },
      });

      return created;
    });

    return NextResponse.json({
      success: true,
      otherExpense,
      message: `Other expense of Rs. ${numAmount.toLocaleString()} (${category}) recorded successfully!`,
    });
  } catch (error) {
    console.error('Create other expense error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get('id'), 10);
    const adminName = searchParams.get('adminName') || 'Fatma';

    if (!id) {
      return NextResponse.json({ success: false, error: 'Other Expense ID is required' }, { status: 400 });
    }

    await withDbRetry(async () => {
      const existing = await prisma.otherExpense.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new Error('Record not found');
      }

      await prisma.otherExpense.delete({
        where: { id },
      });

      await prisma.reconciliationAudit.create({
        data: {
          adminName,
          action: 'OTHER_EXPENSE_DELETED',
          adjustedAmount: existing.amount,
          comment: `Deleted Other Expense #${id}: ${existing.category} - Rs. ${existing.amount.toLocaleString()}`,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Other expense #${id} deleted successfully.`,
    });
  } catch (error) {
    console.error('Delete other expense error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
