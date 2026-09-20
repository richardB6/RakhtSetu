import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { runMatchingEngine } from '@/lib/services/matching.service';

export const POST = withAuth(async (req, context) => {
  try {
    const id = Array.isArray(context.params.id) ? context.params.id[0] : context.params.id;
    const result = await runMatchingEngine(id, context.user.userId, context.user.role === 'ADMIN');
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Matching failed';
    const status = /not found|not valid|cannot match|already /.test(message.toLowerCase()) ? 400 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}, { roles: ['HOSPITAL', 'ADMIN'] });
