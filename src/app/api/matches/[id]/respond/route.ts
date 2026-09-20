import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { respondToMatch } from '@/lib/services/matching.service';

export const POST = withAuth(async (req, context) => {
  try {
    const id = Array.isArray(context.params.id) ? context.params.id[0] : context.params.id;
    const body = await req.json();
    const { accept, declineReason } = body;

    if (accept === undefined) {
      return NextResponse.json({ success: false, message: 'accept field is required' }, { status: 400 });
    }

    const result = await respondToMatch(id, context.user.userId, accept, declineReason);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}, { roles: ['BLOOD_BANK', 'DONOR'] });
