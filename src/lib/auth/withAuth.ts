import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, UserTokenPayload, UserRole } from './jwt';
import { COOKIE_NAMES } from './cookies';
import { connectToDatabase } from '@/lib/db/mongodb';
import { User } from '@/models/User';

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

      await connectToDatabase();
      const currentUser = await User.findById(decoded.userId).select(
        '_id email name role isActive verificationStatus'
      );
      if (
        !currentUser ||
        !currentUser.isActive ||
        currentUser.verificationStatus === 'SUSPENDED'
      ) {
        return NextResponse.json(
          { success: false, message: 'Account is inactive or suspended.' },
          { status: 403 }
        );
      }

      if (options.roles && options.roles.length > 0) {
        if (!options.roles.includes(currentUser.role)) {
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
        user: {
          ...decoded,
          userId: currentUser._id.toString(),
          email: currentUser.email,
          name: currentUser.name,
          role: currentUser.role,
        },
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
