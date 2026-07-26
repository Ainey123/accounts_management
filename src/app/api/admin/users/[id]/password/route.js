import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';

async function changePassword(request, { params }) {
  try {
    const { id: rawId } = await params;
    const targetId = Number(rawId);
    const { password } = await request.json();

    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetId } });
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

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

    if (!requester || requester.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Allow admins to change any password, including other admins

    await prisma.user.update({
      where: { id: targetId },
      data: { password: hashPassword(password) },
    });

    return NextResponse.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json({ error: 'Failed to change password: ' + error.message }, { status: 500 });
  }
}

// Support both PATCH and POST to avoid 405 errors
export async function PATCH(request, context) {
  return changePassword(request, context);
}

export async function POST(request, context) {
  return changePassword(request, context);
}

