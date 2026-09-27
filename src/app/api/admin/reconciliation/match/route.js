import { NextResponse } from 'next/server';
import { runAutoReconciliation, manualAdjustExpense, unmatchExpense } from '@/lib/reconciliationEngine';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json();
    const { action, expenseId, bankTransactionId, adjustedAmount, comment, adminName } = body;

    if (action === 'auto') {
      const result = await runAutoReconciliation({ adminName: adminName || 'Admin' });
      return NextResponse.json({
        success: true,
        message: `Auto-matching complete: ${result.matchedCount} fully matched, ${result.partiallyMatchedCount} partially matched, ${result.reviewRequiredCount} marked for review.`,
        result,
      });
    }

    if (action === 'manual') {
      if (!expenseId) {
        return NextResponse.json({ success: false, error: 'Expense ID is required' }, { status: 400 });
      }

      const updated = await manualAdjustExpense({
        expenseId: parseInt(expenseId, 10),
        bankTransactionId: bankTransactionId ? parseInt(bankTransactionId, 10) : null,
        adjustedAmount: parseFloat(adjustedAmount) || 0,
        comment,
        adminName: adminName || 'Fatma',
      });

      return NextResponse.json({
        success: true,
        message: `Expense #${expenseId} successfully adjusted to Rs. ${(updated.adjustedAmount || 0).toLocaleString()} (Status: ${updated.status}).`,
        expense: updated,
      });
    }

    if (action === 'unmatch') {
      if (!expenseId) {
        return NextResponse.json({ success: false, error: 'Expense ID is required' }, { status: 400 });
      }

      const updated = await unmatchExpense({
        expenseId: parseInt(expenseId, 10),
        adminName: adminName || 'Fatma',
        comment,
      });

      return NextResponse.json({
        success: true,
        message: `Expense #${expenseId} unlinked and reset to Unmatched.`,
        expense: updated,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action specified' }, { status: 400 });
  } catch (error) {
    console.error('Reconciliation match operation error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
