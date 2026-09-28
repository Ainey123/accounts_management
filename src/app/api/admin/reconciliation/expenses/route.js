import { NextResponse } from 'next/server';
import { prisma, withDbRetry } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const statementId = searchParams.get('statementId');
    const search = (searchParams.get('search') || '').trim().toLowerCase();

    const where = {};

    if (employeeId && employeeId !== 'all') {
      where.createdById = parseInt(employeeId, 10);
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (category && category !== 'all') {
      where.category = category;
    }

    if (statementId && statementId !== 'all') {
      where.bankTransaction = {
        statementId: parseInt(statementId, 10),
      };
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

    const expenses = await withDbRetry(async () => {
      return await prisma.expense.findMany({
        where,
        include: {
          jobMetadata: {
            include: {
              assignedEmployee: { select: { id: true, employeeName: true, email: true } },
              ticket: { select: { id: true, serialNo: true, subject: true, exactDate: true, time: true, sender: true } },
            },
          },
          createdBy: { select: { id: true, employeeName: true, email: true } },
          bankTransaction: {
            include: {
              statement: { select: { id: true, bankName: true, fileName: true, statementPeriod: true } },
            },
          },
          reconciliationAudits: {
            take: 5,
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    // In-memory text filtering for flexible search
    let filtered = expenses;
    if (search) {
      filtered = expenses.filter((e) => {
        const empName = e.createdBy?.employeeName || e.jobMetadata?.assignedEmployee?.employeeName || '';
        const client = e.jobMetadata?.clientName || '';
        const branch = e.jobMetadata?.branchName || '';
        const serial = e.jobMetadata?.ticket?.serialNo || '';
        const notes = e.summaryNotes || '';
        const cat = e.category || '';
        const bankDesc = e.bankTransaction?.description || '';
        const bankRef = e.bankTransaction?.referenceNo || '';
        const bankName = e.bankTransaction?.statement?.bankName || '';
        const amtStr = String(e.amount);
        const adjStr = String(e.adjustedAmount);

        return (
          empName.toLowerCase().includes(search) ||
          client.toLowerCase().includes(search) ||
          branch.toLowerCase().includes(search) ||
          serial.toLowerCase().includes(search) ||
          notes.toLowerCase().includes(search) ||
          cat.toLowerCase().includes(search) ||
          bankDesc.toLowerCase().includes(search) ||
          bankRef.toLowerCase().includes(search) ||
          bankName.toLowerCase().includes(search) ||
          amtStr.includes(search) ||
          adjStr.includes(search)
        );
      });
    }

    return NextResponse.json({
      success: true,
      expenses: filtered,
      count: filtered.length,
    });
  } catch (error) {
    console.error('Reconciliation expenses fetch error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
