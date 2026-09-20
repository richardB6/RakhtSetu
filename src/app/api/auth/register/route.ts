import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { User } from '@/models/User';
import { hashPassword } from '@/lib/auth/password';
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt';
import { setAuthCookies } from '@/lib/auth/cookies';
import { registerSchema } from '@/lib/validations/auth.schema';
import { validateRequestBody } from '@/lib/validations/common';

export async function POST(req: NextRequest) {
  try {
    const validation = await validateRequestBody(req, registerSchema);
    if (!validation.success) return validation.response;

    const { email, password, name, phone, role } = validation.data;

    await connectToDatabase();

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'An account with this email already exists.' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await User.create({
      email,
      password: hashedPassword,
      name,
      phone,
      role,
      verificationStatus: role === 'ADMIN' ? 'VERIFIED' : 'PENDING',
    });

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

    // Set cookies
    await setAuthCookies(accessToken, refreshToken);

    return NextResponse.json(
      {
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
            verificationStatus: user.verificationStatus,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Register] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
