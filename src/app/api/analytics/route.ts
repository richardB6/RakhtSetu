import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { getCommandCenterData } from '@/lib/services/command-center.service';

export const GET = withAuth(async (req, context) => {
  try {
    const params = new URL(req.url).searchParams;
    const result = await getCommandCenterData({ userId: context.user.userId, role: context.user.role }, {
      days: Number(params.get('days') || 30),
      from: params.get('from') || undefined,
      to: params.get('to') || undefined,
    });
    return NextResponse.json({ success: true, data: { ...result.analytics, stats: result.stats } });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}, { roles: ['ADMIN', 'HOSPITAL', 'BLOOD_BANK'] });
