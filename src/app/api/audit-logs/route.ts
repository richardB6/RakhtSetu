import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { getAuditLogs } from '@/lib/services/audit.service';

export const GET = withAuth(async (req, context) => {
  try {
    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get('entityType');
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const filters: any = { page, limit };
    if (entityType) filters.entityType = entityType;
    if (userId) filters.userId = userId;
    if (action) filters.action = action;

    const result = await getAuditLogs(filters);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}, { roles: ['ADMIN'] });
