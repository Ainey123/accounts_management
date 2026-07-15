import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPin } from '@/lib/pinHash';
import { verifyPassword } from '@/lib/password';

export async function POST(request) {
  const body = await request.json();
  const { pin, role, employeeName } = body;

  const pinStr = String(pin || '').trim();
  const normalizedRole = String(role || '').toUpperCase();

  // ── ADMIN login ──────────────────────────────────────────────────────────
  if (normalizedRole === 'ADMIN') {
    const ADMIN_PIN = (process.env.ADMIN_PIN || '123456').toString().trim();
    if (pinStr === ADMIN_PIN) {
      return NextResponse.json({
        user: {
          email: 'admin@gmail.com',
          tempPassword: 'temp-admin123',
          role: 'ADMIN',
          id: null,
          employeeName: 'Admin',
        },
      });
    }
    return NextResponse.json({ error: 'Invalid admin PIN' }, { status: 401 });
  }

  // ── EMPLOYEE login ───────────────────────────────────────────────────────
  if (normalizedRole === 'EMPLOYEE') {
    if (!employeeName) {
      return NextResponse.json({ error: 'Please select your name' }, { status: 400 });
    }

    let employee = null;
    try {
      employee = await prisma.user.findFirst({
        where: {
          employeeName: { equals: employeeName.trim(), mode: 'insensitive' },
          role: 'EMPLOYEE',
        },
      });
    } catch (err) {
      console.error('Employee lookup error:', err);
      return NextResponse.json({ error: 'Database error during login' }, { status: 500 });
    }

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found. Contact admin.' }, { status: 401 });
    }

    // Verify PIN — support both hashed (new) and plain-text (legacy) comparison
    const hashedInput = hashPin(pinStr);
    const storedPin = employee.password || '';
    
    let isMatch = storedPin === hashedInput || storedPin === pinStr;
    
    if (!isMatch) {
      try {
        isMatch = verifyPassword(pinStr, storedPin);
      } catch(e) {
        // Ignore verifyPassword errors (e.g. if storedPin is not a valid scrypt format)
      }
    }

    if (!isMatch) {
      return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: employee.id,
        email: employee.email,
        employeeName: employee.employeeName,
        role: 'EMPLOYEE',
        tempPassword: 'temp-user123',
      },
    });
  }

  return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
}