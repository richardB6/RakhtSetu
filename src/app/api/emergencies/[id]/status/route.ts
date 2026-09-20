import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { advanceResponseWorkflow } from '@/lib/services/response.service';
import { RequestStatus } from '@/lib/engine/compatibility';

export const PATCH = withAuth(async (req, context) => {
  try {
    const id = Array.isArray(context.params.id) ? context.params.id[0] : context.params.id;
    const { status } = await req.json();
    if (!status) return NextResponse.json({ success: false, message: 'status is required' }, { status: 400 });
    const data = await advanceResponseWorkflow(id, status as RequestStatus, context.user.userId);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }
}, { roles: ['HOSPITAL', 'ADMIN'] });

