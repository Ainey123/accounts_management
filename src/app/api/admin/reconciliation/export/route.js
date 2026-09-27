import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');
    const format = searchParams.get('format') || 'csv';

    const where = {};
    if (employeeId && employeeId !== 'all') {
      where.createdById = parseInt(employeeId, 10);
    }
    if (status && status !== 'all') {
      where.status = status;
    }
    if (month) {
      const start = new Date(`${month}-01T00:00:00.000Z`);
      const [year, m] = month.split('-').map(Number);
      const nextMonth = m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, '0')}`;
      const end = new Date(`${nextMonth}-01T00:00:00.000Z`);
      where.createdAt = { gte: start, lt: end };
    } else if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        jobMetadata: {
          include: {
            assignedEmployee: true,
            ticket: true,
          },
        },
        createdBy: true,
        bankTransaction: {
          include: { statement: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (format === 'csv') {
      const headers = [
        'Expense ID',
        'Date',
        'Employee Name',
        'Ticket Serial',
        'Client Name',
        'Branch',
        'Category',
        'Claimed Amount (PKR)',
        'Adjusted Amount (PKR)',
        'Remaining Amount (PKR)',
        'Status',
        'Matched Bank',
        'Bank Tx Date',
        'Bank Narration',
        'Bank Ref No',
        'Bank Debit (PKR)',
        'Notes / Summary',
      ];

      const escapeCSV = (str) => {
        if (str === null || str === undefined) return '""';
        const s = String(str).replace(/"/g, '""');
        return `"${s}"`;
      };

      const rows = expenses.map((e) => {
        const dateStr = new Date(e.expenseDate || e.createdAt).toLocaleDateString();
        const emp = e.createdBy?.employeeName || e.jobMetadata?.assignedEmployee?.employeeName || 'N/A';
        const serial = e.jobMetadata?.ticket?.serialNo || 'N/A';
        const client = e.jobMetadata?.clientName || 'N/A';
        const branch = e.jobMetadata?.branchName || 'N/A';
        const cat = e.category || 'Site Expense';
        const claimed = (e.amount || 0).toFixed(2);
        const adjusted = (e.adjustedAmount || 0).toFixed(2);
        const remaining = (e.remainingAmount ?? (e.amount - (e.adjustedAmount || 0))).toFixed(2);
        const st = e.status || 'UNMATCHED';
        const bankName = e.bankTransaction?.statement?.bankName || '';
        const txDate = e.bankTransaction?.transactionDate ? new Date(e.bankTransaction.transactionDate).toLocaleDateString() : '';
        const bankDesc = e.bankTransaction?.description || '';
        const bankRef = e.bankTransaction?.referenceNo || '';
        const bankDebit = e.bankTransaction?.debit ? e.bankTransaction.debit.toFixed(2) : '';
        const notes = e.summaryNotes || '';

        return [
          e.id,
          dateStr,
          emp,
          serial,
          client,
          branch,
          cat,
          claimed,
          adjusted,
          remaining,
          st,
          bankName,
          txDate,
          bankDesc,
          bankRef,
          bankDebit,
          notes,
        ].map(escapeCSV).join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\r\n');

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Expense_Reconciliation_${month || 'Report'}_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({ success: true, count: expenses.length, expenses });
  } catch (error) {
    console.error('Export reconciliation error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
