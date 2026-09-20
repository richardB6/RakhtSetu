import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { User } from '@/models/User';
import { comparePasswords } from '@/lib/auth/password';
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt';
import { setAuthCookies } from '@/lib/auth/cookies';
import { loginSchema } from '@/lib/validations/auth.schema';
import { validateRequestBody } from '@/lib/validations/common';

export async function POST(req: NextRequest) {
  try {
    const validation = await validateRequestBody(req, loginSchema);
    if (!validation.success) return validation.response;

    const { email, password } = validation.data;

    await connectToDatabase();

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await comparePasswords(password, user.password))) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, message: 'This account has been deactivated.' },
        { status: 403 }
      );
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Sign tokens
    const accessToken = await signAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    });
    const refreshToken = await signRefreshToken({
      userId: user._id.toString(),
    });

    await setAuthCookies(accessToken, refreshToken);

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          phone: user.phone,
          verificationStatus: user.verificationStatus,
        },
      },
    });
  } catch (error) {
    console.error('[Login] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
