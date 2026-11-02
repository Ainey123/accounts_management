import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get('userId');

    const authCookie = request.cookies.get('nexus_user');
    let requester = null;
    if (authCookie) {
      try {
        requester = JSON.parse(authCookie.value);
      } catch {}
    }

    const whereClause = {};

    if (userIdParam) {
      whereClause.userId = parseInt(userIdParam, 10);
    } else if (requester && requester.role === 'EMPLOYEE') {
      // Employees only see their own comments by default
      whereClause.userId = parseInt(requester.id, 10);
    } else if (requester && requester.role === 'SUB_ADMIN' && requester.id) {
      // Default supervisor view is their own direct thread with Admin
      whereClause.userId = parseInt(requester.id, 10);
    }

    const comments = await prisma.comment.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'asc', // Chronological order
      },
      include: {
        user: {
          select: {
            id: true,
            employeeName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ comments });
  } catch (error) {
    console.error('Fetch comments error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments: ' + error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const authCookie = request.cookies.get('nexus_user');
    if (!authCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let requester;
    try {
      requester = JSON.parse(authCookie.value);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, content, adminName: customAdminName, broadcastAll } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Comment content is required' }, { status: 400 });
    }

    let senderRole = 'ADMIN';
    let senderName = 'Fatma';

    if (requester.role === 'ADMIN') {
      senderRole = 'ADMIN';
      senderName = (customAdminName && customAdminName.trim()) ? customAdminName.trim() : 'Fatma';
    } else if (requester.role === 'SUB_ADMIN') {
      senderRole = 'SUB_ADMIN';
      senderName = (customAdminName && customAdminName.trim()) ? customAdminName.trim() : 'Supervisor (Sub Admin)';
    } else {
      senderRole = 'EMPLOYEE';
      senderName = requester.employeeName || 'Employee';
    }

    // Support broadcasting to all employees at once
    if (broadcastAll && (requester.role === 'ADMIN' || requester.role === 'SUB_ADMIN')) {
      const activeEmployees = await prisma.user.findMany({
        where: {
          role: { in: ['EMPLOYEE', 'FIELD_EMPLOYEE'] },
          activeStatus: true,
        },
        select: { id: true },
      });

      if (activeEmployees.length > 0) {
        await Promise.all(
          activeEmployees.map((emp) =>
            prisma.comment.create({
              data: {
                userId: emp.id,
                adminId: requester.id ? parseInt(requester.id, 10) : null,
                senderRole,
                senderName,
                adminName: senderName,
                content: content.trim(),
              },
            })
          )
        );
      }
      return NextResponse.json({ success: true, broadcastCount: activeEmployees.length }, { status: 201 });
    }

    let targetUserId = parseInt(userId, 10);
    if (requester.role === 'EMPLOYEE') {
      // Employees post to their own account thread
      targetUserId = parseInt(requester.id, 10);
    }

    if (isNaN(targetUserId)) {
      return NextResponse.json(
        { error: 'Valid target User ID is required' },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const comment = await prisma.comment.create({
      data: {
        userId: targetUserId,
        adminId: (requester.role === 'ADMIN' || requester.role === 'SUB_ADMIN') && requester.id ? parseInt(requester.id, 10) : null,
        senderRole,
        senderName,
        adminName: senderName,
        content: content.trim(),
      },
      include: {
        user: {
          select: {
            id: true,
            employeeName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, comment }, { status: 201 });
  } catch (error) {
    console.error('Create comment error:', error);
    return NextResponse.json(
      { error: 'Failed to create comment: ' + error.message },
      { status: 500 }
    );
  }
}
