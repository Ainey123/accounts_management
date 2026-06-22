import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { sanitizeUser } from '@/lib/api';

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { id: 'asc' },
      include: {
        assignedJobs: {
          include: { ticket: { select: { serialNo: true } } },
        },
      },
    });
    return NextResponse.json({ users: users.map(sanitizeUser) });
  } catch (error) {
    console.error('Users fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { email, password, employeeName, role = 'EMPLOYEE' } = await request.json();

    if (!email || !password || !employeeName) {
      return NextResponse.json({ error: 'Email, password, and employee name are required' }, { status: 400 });
    }

    if (role !== 'EMPLOYEE') {
      return NextResponse.json({ error: 'Only employee accounts can be created via this endpoint' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        email,
        password: hashPassword(password),
        employeeName,
        role: 'EMPLOYEE',
        activeStatus: true,
      },
    });

    return NextResponse.json({ user: sanitizeUser(user) }, { status: 201 });
  } catch (error) {
    console.error('User create error:', error);
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 });
  }
}
