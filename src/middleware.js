import { NextResponse } from 'next/server';

export default function middleware(request) {
  const authCookie = request.cookies.get('nexus_user');
  const { pathname } = request.nextUrl;

  const isPublic =
    pathname === '/' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/seed') ||
    pathname.startsWith('/api/gmail/callback') ||
    pathname === '/api/gmail-sync' ||
    pathname === '/api/fix-db';

  if (!authCookie) {
    if (isPublic) return NextResponse.next();
    // For API routes, return JSON 401 instead of redirecting to HTML page
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    const user = JSON.parse(authCookie.value);

    if (pathname.startsWith('/admin') && user.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    if (
      user.role === 'ADMIN' &&
      (pathname.startsWith('/intake') ||
        pathname.startsWith('/survey') ||
        pathname.startsWith('/quotation') ||
        pathname.startsWith('/approval') ||
        pathname.startsWith('/invoice') ||
        pathname.startsWith('/site') ||
        pathname.startsWith('/payment-status') ||
        pathname.startsWith('/dashboard'))
    ) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }

    return NextResponse.next();
  } catch (e) {
    if (isPublic) return NextResponse.next();
    return NextResponse.redirect(new URL('/', request.url));
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
