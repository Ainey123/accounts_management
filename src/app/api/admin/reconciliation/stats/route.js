import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month'); // e.g. "2026-08"
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const employeeId = searchParams.get('employeeId');

    const expenseWhere = {};
    if (employeeId && employeeId !== 'all') {
      expenseWhere.createdById = parseInt(employeeId, 10);
    }

    if (month) {
      const start = new Date(`${month}-01T00:00:00.000Z`);
      const [year, m] = month.split('-').map(Number);
      const nextMonth = m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, '0')}`;
      const end = new Date(`${nextMonth}-01T00:00:00.000Z`);
      expenseWhere.createdAt = { gte: start, lt: end };
    } else if (startDate || endDate) {
      expenseWhere.createdAt = {};
      if (startDate) expenseWhere.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        expenseWhere.createdAt.lte = end;
      }
    }

    // 1. Fetch expenses
    const expenses = await prisma.expense.findMany({
      where: expenseWhere,
      select: {
        id: true,
        amount: true,
        adjustedAmount: true,
        remainingAmount: true,
        status: true,
        category: true,
      },
    });

    let totalClaimed = 0;
    let totalAdjusted = 0;
    let totalUnmatched = 0;
    const statusCounts = {
      MATCHED: 0,
      PARTIALLY_MATCHED: 0,
      UNMATCHED: 0,
      REVIEW_REQUIRED: 0,
      MANUALLY_ADJUSTED: 0,
    };

    expenses.forEach((e) => {
      const amt = e.amount || 0;
      const adj = e.adjustedAmount || 0;
      totalClaimed += amt;
      totalAdjusted += adj;
      const st = e.status || 'UNMATCHED';
      if (statusCounts[st] !== undefined) statusCounts[st]++;
      else statusCounts.UNMATCHED++;

      if (st === 'MATCHED' || st === 'MANUALLY_ADJUSTED') {
        // fully adjusted
      } else if (st === 'PARTIALLY_MATCHED') {
        totalUnmatched += Math.max(0, amt - adj);
      } else {
        totalUnmatched += amt;
      }
    });

    // 2. Fetch Other Expenses
    const otherExpenseWhere = {};
    if (month) {
      const start = new Date(`${month}-01T00:00:00.000Z`);
      const [year, m] = month.split('-').map(Number);
      const nextMonth = m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, '0')}`;
      const end = new Date(`${nextMonth}-01T00:00:00.000Z`);
      otherExpenseWhere.expenseDate = { gte: start, lt: end };
    } else if (startDate || endDate) {
      otherExpenseWhere.expenseDate = {};
      if (startDate) otherExpenseWhere.expenseDate.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        otherExpenseWhere.expenseDate.lte = end;
      }
    }

    const otherExpenses = await prisma.otherExpense.findMany({
      where: otherExpenseWhere,
      select: { amount: true },
    });

    const totalOtherExpenses = otherExpenses.reduce((sum, o) => sum + (o.amount || 0), 0);

    // 3. Statements Summary
    const statementsCount = await prisma.bankStatement.count();
    const totalBankDebitsResult = await prisma.bankTransaction.aggregate({
      _sum: { debit: true },
    });

    // 4. Recent Audits
    const recentAudits = await prisma.reconciliationAudit.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        expense: { select: { id: true, amount: true, summaryNotes: true } },
        transaction: { select: { id: true, description: true, debit: true } },
      },
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalClaimed: Math.round(totalClaimed * 100) / 100,
        totalAdjusted: Math.round(totalAdjusted * 100) / 100,
        totalUnmatched: Math.round(totalUnmatched * 100) / 100,
        totalOtherExpenses: Math.round(totalOtherExpenses * 100) / 100,
        claimedCount: expenses.length,
        otherExpensesCount: otherExpenses.length,
        statusCounts,
        statementsCount,
        totalBankDebits: totalBankDebitsResult._sum.debit || 0,
      },
      recentAudits,
    });
  } catch (error) {
    console.error('Reconciliation stats error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
