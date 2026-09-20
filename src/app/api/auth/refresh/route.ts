import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { User } from '@/models/User';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/lib/auth/jwt';
import { COOKIE_NAMES, clearAuthCookies, setAuthCookies } from '@/lib/auth/cookies';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get(COOKIE_NAMES.REFRESH_TOKEN)?.value;
    if (!refreshToken) {
      return NextResponse.json({ success: false, message: 'Refresh token required.' }, { status: 401 });
    }

    const decoded = await verifyRefreshToken(refreshToken);
    if (!decoded) {
      await clearAuthCookies();
      return NextResponse.json({ success: false, message: 'Invalid or expired refresh token.' }, { status: 401 });
    }

    await connectToDatabase();
    const user = await User.findById(decoded.userId).select('+password');
    if (!user || !user.isActive || user.verificationStatus !== 'VERIFIED') {
      await clearAuthCookies();
      return NextResponse.json({ success: false, message: 'This account is not verified for operational access.' }, { status: 403 });
    }

    const accessToken = await signAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
      verificationStatus: user.verificationStatus,
    });
    const rotatedRefreshToken = await signRefreshToken({ userId: user._id.toString() });
    await setAuthCookies(accessToken, rotatedRefreshToken);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Auth/Refresh] Error:', error);
    return NextResponse.json({ success: false, message: 'Unable to refresh session.' }, { status: 500 });
  }
}
