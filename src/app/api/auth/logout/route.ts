import { NextResponse } from 'next/server';
import { clearAuthCookies } from '@/lib/auth/cookies';

export async function POST() {
  try {
    await clearAuthCookies();
    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('[Logout] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
