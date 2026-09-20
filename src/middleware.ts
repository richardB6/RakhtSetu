import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { COOKIE_NAMES } from '@/lib/auth/cookies';

const PROTECTED_ROUTES = [
  { prefix: '/dashboard', roles: ['ADMIN', 'HOSPITAL', 'BLOOD_BANK', 'DONOR'] },
  { prefix: '/command-center', roles: ['ADMIN', 'HOSPITAL', 'BLOOD_BANK'] },
  { prefix: '/donor', roles: ['DONOR'] },
  { prefix: '/emergencies', roles: ['ADMIN', 'HOSPITAL', 'BLOOD_BANK'] },
  { prefix: '/map', roles: ['ADMIN', 'HOSPITAL', 'BLOOD_BANK'] },
  { prefix: '/inventory', roles: ['ADMIN', 'BLOOD_BANK'] },
  { prefix: '/donor/availability', roles: ['DONOR'] },
  { prefix: '/blood-bank/status', roles: ['BLOOD_BANK', 'ADMIN'] },
  { prefix: '/blood-banks/status', roles: ['ADMIN'] },
  { prefix: '/donors', roles: ['ADMIN', 'HOSPITAL'] },
  { prefix: '/analytics', roles: ['ADMIN', 'HOSPITAL', 'BLOOD_BANK'] },
  { prefix: '/audit-logs', roles: ['ADMIN'] },
  { prefix: '/verification', roles: ['ADMIN'] },
  { prefix: '/notifications', roles: ['ADMIN', 'HOSPITAL', 'BLOOD_BANK', 'DONOR'] },
  { prefix: '/settings', roles: ['ADMIN', 'HOSPITAL', 'BLOOD_BANK', 'DONOR'] },
  { prefix: '/profile', roles: ['ADMIN', 'HOSPITAL', 'BLOOD_BANK', 'DONOR'] },
];

const AUTH_PAGES = ['/login', '/register'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAMES.ACCESS_TOKEN)?.value;

  const user = token ? await verifyAccessToken(token) : null;

  // Redirect authenticated users away from auth pages
  const isAuthPage = AUTH_PAGES.some((page) => pathname.startsWith(page));
  if (isAuthPage && user) {
    return NextResponse.redirect(new URL(user.role === 'DONOR' ? '/donor' : '/command-center', request.url));
  }

  // Check protected routes
  const matchedRoute = PROTECTED_ROUTES.find((r) => pathname.startsWith(r.prefix));
  if (matchedRoute) {
    if (!user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', encodeURI(pathname));
      return NextResponse.redirect(loginUrl);
    }

    if (!matchedRoute.roles.includes(user.role)) {
      if (pathname.startsWith('/command-center') && user.role === 'DONOR') {
        return NextResponse.redirect(new URL('/donor', request.url));
      }
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    if (user.verificationStatus !== 'VERIFIED') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    // Forward identity downstream
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', user.userId);
    requestHeaders.set('x-user-role', user.role);
    requestHeaders.set('x-user-email', user.email);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
