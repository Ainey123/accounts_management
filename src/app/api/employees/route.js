import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/employees
 * Returns list of employee names for the login screen dropdown.
 * No auth required (public endpoint — only names are exposed, not PINs).
 */
export async function GET() {
  try {
    const employees = await prisma.user.findMany({
      where: { role: 'EMPLOYEE', activeStatus: true },
      select: { id: true, employeeName: true },
      orderBy: { employeeName: 'asc' },
    });
    return NextResponse.json({ employees });
  } catch (error) {
    console.error('Employees list error:', error);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}
