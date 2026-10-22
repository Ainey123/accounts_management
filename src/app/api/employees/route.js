import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/employees
 * Returns list of employee names for login screen dropdowns and job assignment.
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

    const employees = await prisma.user.findMany({
      where,
      select: { id: true, employeeName: true, role: true, email: true },
      orderBy: { employeeName: 'asc' },
    });
    return NextResponse.json({ employees });
  } catch (error) {
    console.error('Employees list error:', error);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}
