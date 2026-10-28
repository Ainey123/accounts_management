import { NextResponse } from 'next/server';
import { prisma, withDbRetry } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { sanitizeUser } from '@/lib/api';
import { sortAndAssignOfficeBatches, getEmployeeGmailScore } from '@/lib/batches';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let users = [];
    try {
      users = await withDbRetry(() =>
        prisma.user.findMany({
          orderBy: { id: 'asc' },
          include: {
            assignedJobs: {
              include: { ticket: { select: { serialNo: true } } },
            },
            _count: {
              select: {
                assignedJobs: true,
                createdJobs: true,
                createdTickets: true,
              },
            },
          },
        })
      );
    } catch (fullErr) {
      console.warn('Full users query failed, trying minimal:', fullErr.message);
      try {
        users = await prisma.user.findMany({
          orderBy: { id: 'asc' },
          include: {
            assignedJobs: true,
          },
        });
      } catch (medErr) {
        console.warn('Medium users query failed, trying basic:', medErr.message);
        users = await prisma.user.findMany({
          orderBy: { id: 'asc' },
        });
      }
    }

    // Compute exact Office Login Batch labels (Batch 1 = highest Gmails, Batch 2 = 2nd, etc.)
    const activeOffice = users.filter((u) => u.role === 'EMPLOYEE' && u.activeStatus);
    const rankedOffice = sortAndAssignOfficeBatches(activeOffice);
    const batchByUserId = new Map(
      rankedOffice.map((emp) => [
        emp.id,
        {
          batchNumber: emp.batchNumber,
          batchLabel: emp.batchLabel,
          gmailCount: emp.gmailCount,
        },
      ])
    );

    const enriched = users.map((u) => {
      const safe = sanitizeUser(u);
      const batchInfo = batchByUserId.get(u.id);
      const score = getEmployeeGmailScore(u);
      return {
        ...safe,
        gmailCount: batchInfo ? batchInfo.gmailCount : score.gmailCount,
        batchNumber: batchInfo ? batchInfo.batchNumber : null,
        batchLabel: batchInfo ? batchInfo.batchLabel : null,
      };
    });

    return NextResponse.json({ users: enriched });
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

    const targetRole = role === 'FIELD_EMPLOYEE' ? 'FIELD_EMPLOYEE' : 'EMPLOYEE';
    if (role !== 'EMPLOYEE' && role !== 'FIELD_EMPLOYEE') {
      return NextResponse.json(
        { error: 'Only employee accounts (EMPLOYEE or FIELD_EMPLOYEE) can be created via this endpoint' },
        { status: 400 }
      );
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
        role: targetRole,
        activeStatus: true,
      },
    });

    return NextResponse.json({ user: sanitizeUser(user) }, { status: 201 });
  } catch (error) {
    console.error('User create error:', error);
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 });
  }
}
