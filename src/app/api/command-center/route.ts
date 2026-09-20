import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { getCommandCenterData } from '@/lib/services/command-center.service';

export const GET = withAuth(async (req: NextRequest, context) => {
  try {
    const params = new URL(req.url).searchParams;
    return NextResponse.json({
      success: true,
      data: await getCommandCenterData({ userId: context.user.userId, role: context.user.role }, {
        severity: params.get('severity') || undefined,
        status: params.get('status') || undefined,
        component: params.get('component') || undefined,
        search: params.get('search') || undefined,
        days: Number(params.get('days') || 30),
        from: params.get('from') || undefined,
        to: params.get('to') || undefined,
      }),
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Unable to load command center' }, { status: 500 });
  }
}, { roles: ['ADMIN', 'HOSPITAL', 'BLOOD_BANK'] });