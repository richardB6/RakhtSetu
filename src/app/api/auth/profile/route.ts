import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { connectToDatabase } from '@/lib/db/mongodb';
import { User, IUserDocument } from '@/models/User';
import { Hospital } from '@/models/Hospital';
import { BloodBank } from '@/models/BloodBank';
import { Donor } from '@/models/Donor';
import { z } from 'zod';
import { formatZodErrors } from '@/lib/validations/common';

const profileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().min(10).max(20).optional(),
  avatar: z.string().url().max(500).nullable().optional(),
}).strict();

async function withRoleProfile(user: IUserDocument) {
  let profile = null;
  if (user.profileId && user.role === 'HOSPITAL') {
    profile = await Hospital.findById(user.profileId).lean();
  } else if (user.profileId && user.role === 'BLOOD_BANK') {
    profile = await BloodBank.findById(user.profileId).lean();
  } else if (user.profileId && user.role === 'DONOR') {
    profile = await Donor.findById(user.profileId).lean();
  }
  return { user, profile };
}

export const GET = withAuth(async (_req, context) => {
  await connectToDatabase();
  const user = await User.findById(context.user.userId).select('-password');
  if (!user) {
    return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: await withRoleProfile(user) });
});

export const PATCH = withAuth(async (req: NextRequest, context) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON payload.' }, { status: 400 });
  }

  const result = profileSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { success: false, message: 'Validation failed.', errors: formatZodErrors(result.error) },
      { status: 422 }
    );
  }

  await connectToDatabase();
  const user = await User.findByIdAndUpdate(
    context.user.userId,
    { $set: result.data },
    { new: true, runValidators: true }
  ).select('-password');
  if (!user) {
    return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: await withRoleProfile(user) });
});
