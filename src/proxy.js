import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/',
  '/api/auth/login',
  '/api/gmail/callback',
  '/api/gmail-oauth',
  '/api/gmail',
];

export function proxy(request) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get('nexus_user');
  if (!authCookie) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    const user = JSON.parse(authCookie.value);
    if (!user || !user.email || !user.role) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    if (pathname.startsWith('/admin') && user.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/', request.url));
  }
}

export const config = {
  matcher: ['/((?!_next).*)'],
};
