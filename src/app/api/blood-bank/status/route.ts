import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth/withAuth';
import { BloodBank } from '@/models/BloodBank';
import { createAuditLog } from '@/lib/services/audit.service';

const schema = z.object({ status: z.enum(['OPEN', 'LIMITED', 'UNAVAILABLE', 'CLOSED']) });

export const GET = withAuth(async (_req, context) => {
  try {
    if (context.user.role === 'ADMIN') {
      const bloodBanks = await BloodBank.find({}).select('name operationalStatus isOpen city state userId').sort({ name: 1 });
      return NextResponse.json({ success: true, data: bloodBanks });
    }
    const bloodBank = await BloodBank.findOne({ userId: context.user.userId }).select('name operationalStatus isOpen');
    if (!bloodBank) return NextResponse.json({ success: false, message: 'Blood bank profile not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: bloodBank });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}, { roles: ['BLOOD_BANK', 'ADMIN'] });

export const PATCH = withAuth(async (req, context) => {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid blood-bank status' }, { status: 400 });
    const requestedBloodBankId = new URL(req.url).searchParams.get('bloodBankId');
    if (context.user.role === 'ADMIN' && !requestedBloodBankId) {
      return NextResponse.json({ success: false, message: 'bloodBankId is required for ADMIN' }, { status: 400 });
    }
    const filter = context.user.role === 'ADMIN'
      ? { _id: requestedBloodBankId }
      : { userId: context.user.userId };
    const bloodBank = await BloodBank.findOne(filter);
    if (!bloodBank) return NextResponse.json({ success: false, message: 'Blood bank profile not found' }, { status: 404 });
    const previous = { operationalStatus: bloodBank.operationalStatus, isOpen: bloodBank.isOpen };
    bloodBank.operationalStatus = parsed.data.status;
    bloodBank.isOpen = ['OPEN', 'LIMITED'].includes(parsed.data.status);
    await bloodBank.save();
    await createAuditLog({
      userId: context.user.userId,
      userRole: context.user.role,
      userName: context.user.name,
      action: 'BLOOD_BANK_STATUS_CHANGED',
      entityType: 'BLOOD_BANK',
      entityId: bloodBank._id.toString(),
      description: `Changed blood-bank operational status to ${parsed.data.status}`,
      previousState: previous,
      newState: { operationalStatus: bloodBank.operationalStatus, isOpen: bloodBank.isOpen },
    });
    return NextResponse.json({ success: true, data: bloodBank });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}, { roles: ['BLOOD_BANK', 'ADMIN'] });