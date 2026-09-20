import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Donor } from '@/models/Donor';
import { createAuditLog } from '@/lib/services/audit.service';
import { z } from 'zod';

const donorAvailabilitySchema = z.object({
  availabilityStatus: z.enum(['AVAILABLE', 'UNAVAILABLE', 'TEMPORARILY_UNAVAILABLE']).optional(),
  availabilityRadius: z.number().min(1).max(200).optional(),
  emergencyNotificationsEnabled: z.boolean().optional(),
});

export const GET = withAuth(async () => {
  try {
    await connectToDatabase();
    const donor = await Donor.findOne({ userId: (globalThis as any).userId || undefined });
    return NextResponse.json({ success: true, data: donor || null });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}, { roles: ['DONOR'] });

export const PATCH = withAuth(async (req, context) => {
  try {
    const body = await req.json();
    const parsed = donorAvailabilitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: 'Invalid donor availability update', errors: parsed.error.flatten() }, { status: 400 });
    }

    await connectToDatabase();
    const donor = await Donor.findOne({ userId: context.user.userId });
    if (!donor) {
      return NextResponse.json({ success: false, message: 'Donor profile not found' }, { status: 404 });
    }

    const previous = {
      availabilityStatus: donor.availabilityStatus,
      isAvailable: donor.isAvailable,
      availabilityRadius: donor.availabilityRadius,
      emergencyNotificationsEnabled: donor.emergencyNotificationsEnabled,
    };

    if (parsed.data.availabilityStatus) {
      donor.availabilityStatus = parsed.data.availabilityStatus;
      donor.isAvailable = parsed.data.availabilityStatus === 'AVAILABLE';
    }
    if (parsed.data.availabilityRadius !== undefined) donor.availabilityRadius = parsed.data.availabilityRadius;
    if (parsed.data.emergencyNotificationsEnabled !== undefined) donor.emergencyNotificationsEnabled = parsed.data.emergencyNotificationsEnabled;

    await donor.save();

    await createAuditLog({
      userId: context.user.userId,
      userRole: 'DONOR',
      userName: context.user.name,
      action: 'DONOR_AVAILABILITY_UPDATED',
      entityType: 'DONOR',
      entityId: donor._id.toString(),
      description: 'Updated donor operational availability settings',
      previousState: previous,
      newState: {
        availabilityStatus: donor.availabilityStatus,
        isAvailable: donor.isAvailable,
        availabilityRadius: donor.availabilityRadius,
        emergencyNotificationsEnabled: donor.emergencyNotificationsEnabled,
      },
    });

    return NextResponse.json({ success: true, data: donor });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}, { roles: ['DONOR'] });
