import { NextResponse } from 'next/server';

export function proxy(request) {
  const authCookie = request.cookies.get('nexus_user');
  if (!authCookie) {
    const { pathname } = request.nextUrl;
    if (
      pathname === '/' ||
      pathname.startsWith('/intake') ||
      pathname.startsWith('/survey') ||
      pathname.startsWith('/quotation') ||
      pathname.startsWith('/approval') ||
      pathname.startsWith('/invoice') ||
      pathname.startsWith('/site') ||
      pathname.startsWith('/ledger') ||
      pathname.startsWith('/dashboard')
    ) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    return NextResponse.next();
  }

  try {
    const user = JSON.parse(authCookie.value);
    const { pathname } = request.nextUrl;

    if (pathname.startsWith('/admin') && user.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    if (
      user.role === 'ADMIN' &&
      (pathname === '/' ||
        pathname.startsWith('/intake') ||
        pathname.startsWith('/survey') ||
        pathname.startsWith('/quotation') ||
        pathname.startsWith('/approval') ||
        pathname.startsWith('/invoice') ||
        pathname.startsWith('/site') ||
        pathname.startsWith('/ledger') ||
        pathname.startsWith('/dashboard'))
    ) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }

    return NextResponse.next();
  } catch (e) {
    const { pathname } = request.nextUrl;
    if (
      pathname === '/' ||
      pathname.startsWith('/intake') ||
      pathname.startsWith('/survey') ||
      pathname.startsWith('/quotation') ||
      pathname.startsWith('/approval') ||
      pathname.startsWith('/invoice') ||
      pathname.startsWith('/site') ||
      pathname.startsWith('/ledger') ||
      pathname.startsWith('/dashboard')
    ) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
