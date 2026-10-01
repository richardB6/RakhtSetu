import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { COOKIE_NAMES } from '@/lib/auth/cookies';
import { findProtectedRoute } from '@/lib/auth/route-access';

/**
 * Route protection configuration.
 * prefix — URL path prefix to protect.
 * roles  — Roles that are allowed access. All others are redirected.
 *
 * Order matters: more specific prefixes must appear BEFORE less specific ones
 * (e.g. /emergencies/new before /emergencies, /donor/availability before /donor).
 */
const AUTH_PAGES = ['/login', '/register'];

/**
 * Next.js 16 Proxy (previously called Middleware).
 * - Validates JWT tokens at the edge.
 * - Redirects unauthenticated users to /login.
 * - Redirects users whose role is not authorised for the route to /unauthorized.
 * - Forwards verified identity headers (x-user-id, x-user-role, x-user-email)
 *   to downstream API route handlers.
 * - Does NOT replace server-side authorisation in API handlers; those also
 *   re-validate the token via withAuth() on every request.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAMES.ACCESS_TOKEN)?.value;

  const user = token ? await verifyAccessToken(token) : null;

  // Redirect authenticated users away from login / register pages.
  const isAuthPage = AUTH_PAGES.some((page) => pathname.startsWith(page));
  if (isAuthPage && user) {
    return NextResponse.redirect(
      new URL(user.role === 'DONOR' ? '/donor' : '/command-center', request.url)
    );
  }

  // Find the first matching protected route.
  const matchedRoute = findProtectedRoute(pathname);
  if (matchedRoute) {
    // Unauthenticated — send to login with a callback URL.
    if (!user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', encodeURI(pathname));
      return NextResponse.redirect(loginUrl);
    }

    // Wrong role.
    if (!matchedRoute.roles.includes(user.role)) {
      // Donors who somehow reach the command-center get sent to their dashboard.
      if (pathname.startsWith('/command-center') && user.role === 'DONOR') {
        return NextResponse.redirect(new URL('/donor', request.url));
      }
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    // Suspended or rejected accounts cannot access the platform.
    if (
      user.verificationStatus === 'REJECTED' ||
      user.verificationStatus === 'SUSPENDED'
    ) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    // Forward verified identity to downstream handlers.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id',    user.userId);
    requestHeaders.set('x-user-role',  user.role);
    requestHeaders.set('x-user-email', user.email);

    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static assets.
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
