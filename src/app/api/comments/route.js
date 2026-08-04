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
    const { userId, content, adminName: customAdminName } = body;

    let targetUserId = parseInt(userId, 10);
    if (requester.role === 'EMPLOYEE') {
      // Employees post to their own account thread
      targetUserId = parseInt(requester.id, 10);
    }

    if (isNaN(targetUserId) || !content || !content.trim()) {
      return NextResponse.json(
        { error: 'Target User ID and comment content are required' },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let senderRole = 'ADMIN';
    let senderName = 'Fatma';

    if (requester.role === 'ADMIN') {
      senderRole = 'ADMIN';
      // Default to "Fatma" unless manually specified otherwise (e.g. Anie)
      senderName = (customAdminName && customAdminName.trim()) ? customAdminName.trim() : 'Fatma';
    } else {
      senderRole = 'EMPLOYEE';
      senderName = requester.employeeName || 'Employee';
    }

    const comment = await prisma.comment.create({
      data: {
        userId: targetUserId,
        adminId: requester.role === 'ADMIN' && requester.id ? parseInt(requester.id, 10) : null,
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
