import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { escalateTimedOutRequest } from '@/lib/services/response.service';

export const POST = withAuth(async (req, context) => {
  try {
    const id = Array.isArray(context.params.id) ? context.params.id[0] : context.params.id;
    const body = await req.json().catch(() => ({}));
    const data = await escalateTimedOutRequest(id, context.user.userId, body.force === true);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }
}, { roles: ['HOSPITAL', 'ADMIN'] });

