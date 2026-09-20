import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { markAsRead } from '@/lib/services/notification.service';

export const PATCH = withAuth(async (req, context) => {
  try {
    const id = Array.isArray(context.params.id) ? context.params.id[0] : context.params.id;
    await markAsRead(id, context.user.userId);
    return NextResponse.json({ success: true, message: 'Notification marked as read' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
});
