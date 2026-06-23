import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';

export async function GET() {
  return POST();
}

export async function POST() {
  try {
    const adminEmail = 'admin@gmail.com';
    const employeeEmail = 'user@gmail.com';

    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

    if (existingAdmin) {
      return NextResponse.json({ message: 'Seed data already exists' });
    }

    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashPassword('password123'),
        role: 'ADMIN',
        employeeName: 'System Administrator',
        activeStatus: true,
      },
    });

    await prisma.user.create({
      data: {
        email: employeeEmail,
        password: hashPassword('user123'),
        role: 'EMPLOYEE',
        employeeName: 'Default User',
        activeStatus: true,
      },
    });

    return NextResponse.json({
      message: 'Seed complete',
      credentials: {
        admin: { email: adminEmail, password: 'password123' },
        employee: { email: employeeEmail, password: 'user123' },
      },
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Failed to seed database: ' + error.message }, { status: 500 });
  }
}
