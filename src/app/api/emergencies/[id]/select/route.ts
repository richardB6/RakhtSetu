import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { selectAcceptedMatch } from '@/lib/services/response.service';

export const POST = withAuth(async (req, context) => {
  try {
    const id = Array.isArray(context.params.id) ? context.params.id[0] : context.params.id;
    const { matchId } = await req.json();
    if (!matchId) return NextResponse.json({ success: false, message: 'matchId is required' }, { status: 400 });
    return NextResponse.json({
      success: true,
      data: await selectAcceptedMatch(id, matchId, context.user.userId, context.user.role === 'ADMIN'),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }
}, { roles: ['HOSPITAL', 'ADMIN'] });
