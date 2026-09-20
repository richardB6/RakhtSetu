import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { markAllAsRead } from '@/lib/services/notification.service';

export const POST = withAuth(async (req, context) => {
  try {
    await markAllAsRead(context.user.userId);
    return NextResponse.json({ success: true, message: 'All notifications marked as read' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
});
