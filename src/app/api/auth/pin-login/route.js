import { NextResponse } from 'next/server';
import { prisma, withDbRetry } from '@/lib/prisma';
import { hashPin } from '@/lib/pinHash';
import { verifyPassword } from '@/lib/password';
import { sortAndAssignOfficeBatches } from '@/lib/batches';

export async function POST(request) {
  const body = await request.json();
  const { pin, role, employeeId, batchLabel, employeeName } = body;

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

  // ── EMPLOYEE (Office Batch) login ─────────────────────────────────────────
  if (normalizedRole === 'EMPLOYEE') {
    const parsedId = employeeId ? Number(employeeId) : null;
    const rawIdentifier = String(batchLabel || employeeName || '').trim();

    if (!parsedId && !rawIdentifier) {
      return NextResponse.json({ error: 'Please select your batch' }, { status: 400 });
    }

    let employee = null;
    let resolvedBatchLabel = null;

    try {
      const officeUsers = await withDbRetry(() =>
        prisma.user.findMany({
          where: { role: 'EMPLOYEE', activeStatus: true },
          include: {
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

      const rankedBatches = sortAndAssignOfficeBatches(officeUsers);

      if (parsedId && !Number.isNaN(parsedId)) {
        employee = rankedBatches.find((u) => u.id === parsedId) || null;
      }

      if (!employee && rawIdentifier) {
        const batchMatch = rawIdentifier.match(/^batch\s*0*(\d+)$/i);
        if (batchMatch) {
          const targetBatchNum = parseInt(batchMatch[1], 10);
          employee = rankedBatches.find((u) => u.batchNumber === targetBatchNum) || null;
        } else {
          employee =
            rankedBatches.find(
              (u) => (u.employeeName || '').toLowerCase().trim() === rawIdentifier.toLowerCase()
            ) || null;
        }
      }

      if (employee) {
        resolvedBatchLabel = employee.batchLabel;
      }
    } catch (err) {
      console.error('Employee lookup error:', err);
      return NextResponse.json({ error: 'Database error during login' }, { status: 500 });
    }

    if (!employee) {
      return NextResponse.json({ error: 'Office batch not found. Contact admin.' }, { status: 401 });
    }

    // Verify PIN — support both hashed (new) and plain-text (legacy) comparison
    const hashedInput = hashPin(pinStr);
    const storedPin = employee.password || '';

    let isMatch = storedPin === hashedInput || storedPin === pinStr;

    if (!isMatch) {
      try {
        isMatch = verifyPassword(pinStr, storedPin);
      } catch (e) {
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
        batchLabel: resolvedBatchLabel || 'Batch 1',
        role: 'EMPLOYEE',
        tempPassword: 'temp-user123',
      },
    });
  }

  // ── FIELD EMPLOYEE login ──────────────────────────────────────────────────
  if (normalizedRole === 'FIELD_EMPLOYEE' || normalizedRole === 'FIELD') {
    if (!employeeName && !employeeId) {
      return NextResponse.json({ error: 'Please select your name' }, { status: 400 });
    }

    let employee = null;
    try {
      employee = await withDbRetry(() =>
        prisma.user.findFirst({
          where: employeeId
            ? { id: Number(employeeId), role: 'FIELD_EMPLOYEE', activeStatus: true }
            : {
                employeeName: { equals: String(employeeName).trim(), mode: 'insensitive' },
                role: 'FIELD_EMPLOYEE',
                activeStatus: true,
              },
        })
      );
    } catch (err) {
      console.error('Field employee lookup error:', err);
      return NextResponse.json({ error: 'Database error during login' }, { status: 500 });
    }

    if (!employee) {
      return NextResponse.json({ error: 'Field employee not found. Contact admin.' }, { status: 401 });
    }

    // Verify PIN
    const hashedInput = hashPin(pinStr);
    const storedPin = employee.password || '';

    let isMatch = storedPin === hashedInput || storedPin === pinStr;
    if (!isMatch) {
      try {
        isMatch = verifyPassword(pinStr, storedPin);
      } catch (e) {}
    }

    if (!isMatch) {
      return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: employee.id,
        email: employee.email,
        employeeName: employee.employeeName,
        role: 'FIELD_EMPLOYEE',
        tempPassword: 'temp-user123',
      },
    });
  }

  return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
}
