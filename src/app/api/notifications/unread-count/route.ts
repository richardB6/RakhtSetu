import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { getUnreadCount } from '@/lib/services/notification.service';

export const GET = withAuth(async (req, context) => {
  try {
    const count = await getUnreadCount(context.user.userId);
    return NextResponse.json({ success: true, count });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
});
