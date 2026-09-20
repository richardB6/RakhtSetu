import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth/withAuth';
import { BloodBank } from '@/models/BloodBank';
import { Reservation } from '@/models/Reservation';
import { releaseRequestReservations } from '@/lib/services/reservation.service';

const schema = z.object({ reservationId: z.string().optional(), emergencyRequestId: z.string().optional(), reason: z.string().trim().min(3).max(200) }).refine((value) => value.reservationId || value.emergencyRequestId, { message: 'reservationId or emergencyRequestId is required' });

export const POST = withAuth(async (req, context) => {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ success: false, message: 'emergencyRequestId and reason are required' }, { status: 400 });
    const reservation = await Reservation.findOne({
      ...(parsed.data.reservationId ? { _id: parsed.data.reservationId } : { emergencyRequestId: parsed.data.emergencyRequestId }),
      status: 'ACTIVE',
    });
    if (!reservation) return NextResponse.json({ success: false, message: 'No active reservation found' }, { status: 404 });
    if (context.user.role === 'BLOOD_BANK') {
      const owned = await BloodBank.findOne({ _id: reservation.bloodBankId, userId: context.user.userId });
      if (!owned) return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }
    const released = await releaseRequestReservations(reservation.emergencyRequestId.toString(), parsed.data.reason, {
      userId: context.user.userId,
      userName: context.user.name,
    });
    return NextResponse.json({ success: true, data: released });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 409 });
  }
}, { roles: ['BLOOD_BANK', 'ADMIN'] });