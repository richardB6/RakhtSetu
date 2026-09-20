import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { getNotifications } from '@/lib/services/notification.service';

export const GET = withAuth(async (req, context) => {
  try {
    const { searchParams } = new URL(req.url);
    const isRead = searchParams.get('isRead');
    const severity = searchParams.get('severity') as any;
    const type = searchParams.get('type') as any;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const filters: any = { page, limit };
    if (isRead !== null) filters.isRead = isRead === 'true';
    if (severity) filters.severity = severity;
    if (type) filters.type = type;

    const result = await getNotifications(context.user.userId, filters);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
});
