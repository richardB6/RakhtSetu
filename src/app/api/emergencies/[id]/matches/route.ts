import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { getMatchesForRequest } from '@/lib/services/matching.service';
import { assertEmergencyOwner, getEmergencyById } from '@/lib/services/emergency.service';

export const GET = withAuth(async (req, context) => {
  try {
    const id = Array.isArray(context.params.id) ? context.params.id[0] : context.params.id;
    if (context.user.role === 'BLOOD_BANK') {
      // Blood banks may only see matches addressed to their own account.
      const result = await getMatchesForRequest(id, context.user.userId, context.user.role);
      return NextResponse.json({ success: true, data: result });
    }
    const request = context.user.role === 'ADMIN'
      ? await getEmergencyById(id)
      : await assertEmergencyOwner(id, context.user.userId);
    const result = await getMatchesForRequest(request._id.toString(), context.user.userId, context.user.role);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Unable to load matches';
    const status = /access|not found/i.test(message) ? 403 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}, { roles: ['ADMIN', 'HOSPITAL', 'BLOOD_BANK'] });
