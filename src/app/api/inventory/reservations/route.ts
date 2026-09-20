import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { BloodBank } from '@/models/BloodBank';
import { Reservation } from '@/models/Reservation';

export const GET = withAuth(async (_req, context) => {
  try {
    const bank = await BloodBank.findOne({ userId: context.user.userId }).select('_id');
    if (!bank) return NextResponse.json({ success: false, message: 'Blood bank profile not found' }, { status: 404 });
    const reservations = await Reservation.find({ bloodBankId: bank._id, status: 'ACTIVE' })
      .populate('emergencyRequestId', 'requestId bloodGroup component quantity status')
      .sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: reservations });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}, { roles: ['BLOOD_BANK'] });