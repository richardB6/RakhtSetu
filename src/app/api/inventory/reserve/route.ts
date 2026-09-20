import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth/withAuth';
import { BloodBank } from '@/models/BloodBank';
import { Match } from '@/models/Match';
import { reserveAcceptedMatch } from '@/lib/services/reservation.service';

const schema = z.object({ matchId: z.string().min(1) });

export const POST = withAuth(async (req, context) => {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ success: false, message: 'matchId is required' }, { status: 400 });
    const match = await Match.findById(parsed.data.matchId);
    if (!match || match.resourceType !== 'BLOOD_BANK') return NextResponse.json({ success: false, message: 'Blood-bank match not found' }, { status: 404 });
    const bloodBank = await BloodBank.findOne({ _id: match.resourceId, userId: context.user.userId });
    if (!bloodBank) return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    const reservation = await reserveAcceptedMatch(match._id.toString(), { userId: context.user.userId, userName: context.user.name });
    return NextResponse.json({ success: true, data: reservation }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: /available|reserved|accepted/i.test(error.message) ? 409 : 500 });
  }
}, { roles: ['BLOOD_BANK', 'ADMIN'] });