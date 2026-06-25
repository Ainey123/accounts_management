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

    // Upsert admin — always reset password to known value
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        password: hashPassword('password123'),
        role: 'ADMIN',
        employeeName: 'System Administrator',
        activeStatus: true,
      },
      create: {
        email: adminEmail,
        password: hashPassword('password123'),
        role: 'ADMIN',
        employeeName: 'System Administrator',
        activeStatus: true,
      },
    });

    // Upsert employee — always reset password to known value
    await prisma.user.upsert({
      where: { email: employeeEmail },
      update: {
        password: hashPassword('user123'),
        role: 'EMPLOYEE',
        employeeName: 'Default User',
        activeStatus: true,
      },
      create: {
        email: employeeEmail,
        password: hashPassword('user123'),
        role: 'EMPLOYEE',
        employeeName: 'Default User',
        activeStatus: true,
      },
    });

    return NextResponse.json({
      message: 'Seed complete — users created/reset successfully',
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
