import { NextResponse } from 'next/server';
import { prisma, withDbRetry } from '@/lib/prisma';
import { sortAndAssignOfficeBatches } from '@/lib/batches';

export const dynamic = 'force-dynamic';

/**
 * GET /api/employees
 * Returns list of office batches (Batch 1, Batch 2, ... ordered by highest Gmails)
 * and field employee accounts for login screen dropdowns.
 * Supports ?role=EMPLOYEE, ?role=FIELD_EMPLOYEE, or ?all=true
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const roleParam = searchParams.get('role');
    const allParam = searchParams.get('all');

    let where = { activeStatus: true };
    if (roleParam) {
      where.role = roleParam;
    } else if (allParam === 'true') {
      where.role = { in: ['EMPLOYEE', 'FIELD_EMPLOYEE'] };
    } else {
      where.role = { in: ['EMPLOYEE', 'FIELD_EMPLOYEE'] };
    }

    const rawUsers = await withDbRetry(() =>
      prisma.user.findMany({
        where,
        select: {
          id: true,
          employeeName: true,
          role: true,
          _count: {
            select: {
              assignedJobs: true,
              createdJobs: true,
              createdTickets: true,
            },
          },
        },
        orderBy: { id: 'asc' },
      })
    );

    const officeUsers = rawUsers.filter((u) => u.role === 'EMPLOYEE');
    const fieldUsers = rawUsers
      .filter((u) => u.role === 'FIELD_EMPLOYEE')
      .sort((a, b) => (a.employeeName || '').localeCompare(b.employeeName || ''));

    // Office login strictly exposes Batch 1, Batch 2, Batch 3, Batch 4... ranked by highest Gmails
    const rankedOffice = sortAndAssignOfficeBatches(officeUsers).map((emp) => ({
      id: emp.id,
      batchNumber: emp.batchNumber,
      batchLabel: emp.batchLabel,
      displayLabel: emp.batchLabel,
      gmailCount: emp.gmailCount,
      role: 'EMPLOYEE',
    }));

    const mappedField = fieldUsers.map((emp) => ({
      id: emp.id,
      employeeName: emp.employeeName,
      displayLabel: emp.employeeName,
      role: 'FIELD_EMPLOYEE',
    }));

    return NextResponse.json({
      employees: [...rankedOffice, ...mappedField],
    });
  } catch (error) {
    console.error('Employees list error:', error);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}
