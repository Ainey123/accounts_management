import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import { sanitizeUser } from '@/lib/api';

export async function POST(request) {
  try {
    const { email, password, role } = await request.json();

    if (!email || !password || !role) {
      return NextResponse.json({ error: 'Email, password, and role are required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.role !== role || !user.activeStatus) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (!verifyPassword(password, user.password)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const safe = sanitizeUser(user);
    const response = NextResponse.json({ user: safe });
    response.cookies.set('nexus_user', JSON.stringify(safe), {
      httpOnly: false,
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    console.error('Login error:', error);
    const message = error.message || 'Authentication failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
