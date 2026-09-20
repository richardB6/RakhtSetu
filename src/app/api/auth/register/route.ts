import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { User } from '@/models/User';
import { Hospital } from '@/models/Hospital';
import { BloodBank } from '@/models/BloodBank';
import { Donor } from '@/models/Donor';
import { hashPassword } from '@/lib/auth/password';
import {
  registerSchema,
  hospitalProfileSchema,
  bloodBankProfileSchema,
  donorProfileSchema,
} from '@/lib/validations/auth.schema';
import { formatZodErrors, validateRequestBody } from '@/lib/validations/common';
import { Verification } from '@/models/Verification';
import { createAuditLog } from '@/lib/services/audit.service';

export async function POST(req: NextRequest) {
  try {
    const validation = await validateRequestBody(req, registerSchema);
    if (!validation.success) return validation.response;

    const { email, password, name, phone, role, profile } = validation.data;
    if (role === 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'Administrator accounts can only be created through the verification workflow.' },
        { status: 403 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { success: false, message: 'A role-specific profile is required.' },
        { status: 422 }
      );
    }
    const validationResult =
      role === 'HOSPITAL'
        ? hospitalProfileSchema.safeParse(profile)
        : role === 'BLOOD_BANK'
          ? bloodBankProfileSchema.safeParse(profile)
          : donorProfileSchema.safeParse(profile);
    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, message: 'Invalid role-specific profile.', errors: formatZodErrors(validationResult.error) },
        { status: 422 }
      );
    }
    await connectToDatabase();

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'An account with this email already exists.' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await User.create({
      email,
      password: hashedPassword,
      name,
      phone,
      role,
      verificationStatus: 'PENDING',
    });

    let profileDocument;
    if (role === 'HOSPITAL') {
      const parsedProfile = hospitalProfileSchema.safeParse(profile);
      if (!parsedProfile.success) {
        return NextResponse.json({ success: false, message: 'Invalid role-specific profile.', errors: formatZodErrors(parsedProfile.error) }, { status: 422 });
      }
      profileDocument = await Hospital.create({ ...parsedProfile.data, userId: user._id });
    } else if (role === 'BLOOD_BANK') {
      const parsedProfile = bloodBankProfileSchema.safeParse(profile);
      if (!parsedProfile.success) {
        return NextResponse.json({ success: false, message: 'Invalid role-specific profile.', errors: formatZodErrors(parsedProfile.error) }, { status: 422 });
      }
      profileDocument = await BloodBank.create({ ...parsedProfile.data, userId: user._id });
    } else {
      const parsedProfile = donorProfileSchema.safeParse(profile);
      if (!parsedProfile.success) {
        return NextResponse.json({ success: false, message: 'Invalid role-specific profile.', errors: formatZodErrors(parsedProfile.error) }, { status: 422 });
      }
      profileDocument = await Donor.create({ ...parsedProfile.data, userId: user._id });
    }
    user.profileId = profileDocument._id;
    await user.save();
    await Verification.create({
      userId: user._id,
      entityType: role,
      status: 'PENDING',
    });
    await createAuditLog({
      userId: user._id.toString(),
      userRole: role,
      userName: user.name,
      action: 'VERIFICATION_CREATED',
      entityType: 'VERIFICATION',
      entityId: user._id.toString(),
      description: `Pending verification created for ${role}`,
      newState: { status: 'PENDING', entityType: role },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
            verificationStatus: user.verificationStatus,
            profileId: user.profileId,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Register] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
