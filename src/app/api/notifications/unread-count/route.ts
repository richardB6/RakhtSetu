import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { getUnreadCount } from '@/lib/services/notification.service';

/**
 * GET /api/notifications/unread-count
 * Returns { success: true, data: { count: N } }
 * Frontend reads data.data?.count
 */
export const GET = withAuth(async (_req, context) => {
  try {
    const count = await getUnreadCount(context.user.userId);
    return NextResponse.json({ success: true, data: { count } });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
});
