import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function getUserId(request) {
  const authCookie = request.headers.get('x-user-id') || request.cookies.get('nexus_user')?.value;
  if (!authCookie) return null;

  try {
    const parsed = typeof authCookie === 'string' && authCookie.startsWith('{') ? JSON.parse(authCookie) : null;
    return parsed?.id || null;
  } catch {
    return null;
  }
}

export async function GET(request) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: { userId: Number(userId) },
      orderBy: { attendanceDate: 'desc' },
    });

    return NextResponse.json({ attendanceRecords });
  } catch (error) {
    console.error('Attendance fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch attendance records' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { attendanceDate, status, reason } = await request.json();
    if (!attendanceDate || !status) {
      return NextResponse.json({ error: 'attendanceDate and status are required' }, { status: 400 });
    }

    const record = await prisma.attendanceRecord.upsert({
      where: {
        userId_attendanceDate: {
          userId: Number(userId),
          attendanceDate: new Date(attendanceDate),
        },
      },
      update: {
        status,
        reason: reason || null,
      },
      create: {
        userId: Number(userId),
        attendanceDate: new Date(attendanceDate),
        status,
        reason: reason || null,
      },
    });

    return NextResponse.json({ attendanceRecord: record }, { status: 201 });
  } catch (error) {
    console.error('Attendance create/update error:', error);
    return NextResponse.json({ error: 'Failed to save attendance record' }, { status: 500 });
  }
}
