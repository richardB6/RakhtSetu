import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, UserTokenPayload, UserRole } from './jwt';
import { COOKIE_NAMES } from './cookies';

export interface AuthenticatedContext {
  user: UserTokenPayload;
  params: Record<string, string | string[]>;
}

export type AuthenticatedHandler = (
  req: NextRequest,
  context: AuthenticatedContext
) => Promise<NextResponse> | NextResponse;

interface AuthOptions {
  roles?: UserRole[];
}

export function withAuth(
  handler: AuthenticatedHandler,
  options: AuthOptions = {}
) {
  return async (
    req: NextRequest,
    { params }: { params?: Promise<Record<string, string | string[]>> } = {}
  ) => {
    try {
      const token =
        req.cookies.get(COOKIE_NAMES.ACCESS_TOKEN)?.value ||
        req.headers.get('authorization')?.replace(/^Bearer\s+/, '');

      if (!token) {
        return NextResponse.json(
          { success: false, message: 'Authentication required.' },
          { status: 401 }
        );
      }

      const decoded = await verifyAccessToken(token);
      if (!decoded) {
        return NextResponse.json(
          { success: false, message: 'Invalid or expired token.' },
          { status: 401 }
        );
      }

      if (options.roles && options.roles.length > 0) {
        if (!options.roles.includes(decoded.role)) {
          return NextResponse.json(
            {
              success: false,
              message: `Forbidden: requires role [${options.roles.join(', ')}]`,
            },
            { status: 403 }
          );
        }
      }

      const resolvedParams = params ? await params : {};

      return await handler(req, {
        user: decoded,
        params: resolvedParams,
      });
    } catch (error) {
      console.error('[withAuth] Error:', error);
      return NextResponse.json(
        { success: false, message: 'Internal authorization error' },
        { status: 500 }
      );
    }
  };
}
