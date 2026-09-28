import { NextResponse } from 'next/server';
import { prisma, withDbRetry } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get('search') || '').trim().toLowerCase();
    const statementId = searchParams.get('statementId');
    const debitsOnly = searchParams.get('debitsOnly') !== 'false';
    const matchStatus = searchParams.get('matchStatus');

    const where = {};
    if (debitsOnly) {
      where.debit = { gt: 0 };
    }
    if (statementId && statementId !== 'all') {
      where.statementId = parseInt(statementId, 10);
    }
    if (matchStatus && matchStatus !== 'all') {
      where.matchStatus = matchStatus;
    }

    const transactions = await withDbRetry(async () => {
      return await prisma.bankTransaction.findMany({
        where,
        include: {
          statement: { select: { id: true, bankName: true, fileName: true, statementPeriod: true } },
        },
        orderBy: { transactionDate: 'desc' },
        take: 200,
      });
    });

    let filtered = transactions;
    if (search) {
      filtered = transactions.filter((t) => {
        const desc = (t.description || '').toLowerCase();
        const ref = (t.referenceNo || '').toLowerCase();
        const bank = (t.statement?.bankName || '').toLowerCase();
        const debit = String(t.debit);
        return desc.includes(search) || ref.includes(search) || bank.includes(search) || debit.includes(search);
      });
    }

    return NextResponse.json({
      success: true,
      transactions: filtered,
      count: filtered.length,
    });
  } catch (error) {
    console.error('Fetch bank transactions error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
