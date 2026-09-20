import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { getMatchesForRequest } from '@/lib/services/matching.service';

export const GET = withAuth(async (req, context) => {
  try {
    const id = Array.isArray(context.params.id) ? context.params.id[0] : context.params.id;
    const result = await getMatchesForRequest(id);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
});
