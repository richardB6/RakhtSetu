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
import { env } from '@/lib/config/env';
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt';
import { setAuthCookies } from '@/lib/auth/cookies';

/**
 * Determine the initial verification status for a new account.
 * - DONOR: always requires administrator verification.
 * - HOSPITAL / BLOOD_BANK: auto-verified in DEMO_MODE so the platform can be tested
 *   end-to-end without a running admin workflow; PENDING in production.
 */
export function initialVerificationStatus(role: string): 'VERIFIED' | 'PENDING' {
  if (role === 'DONOR') return 'PENDING';
  if (env.DEMO_MODE === 'true') return 'VERIFIED';
  return 'PENDING';
}

export async function POST(req: NextRequest) {
  try {
    const validation = await validateRequestBody(req, registerSchema);
    if (!validation.success) return validation.response;

    const { email, password, name, phone, role, profile } = validation.data;

    // Normalize email to lowercase
    const normalizedEmail = email.trim().toLowerCase();

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

    // Validate the role-specific profile
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

    // Duplicate email check (case-insensitive)
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'An account with this email already exists.' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user record
    const verificationStatus = initialVerificationStatus(role);
    const user = await User.create({
      email: normalizedEmail,
      password: hashedPassword,
      name: name.trim(),
      phone: phone.trim(),
      role,
      verificationStatus,
    });

    // Create role-specific profile
    let profileDocument;
    if (role === 'HOSPITAL') {
      const parsedProfile = hospitalProfileSchema.safeParse(profile);
      if (!parsedProfile.success) {
        await User.findByIdAndDelete(user._id); // rollback
        return NextResponse.json({ success: false, message: 'Invalid hospital profile.', errors: formatZodErrors(parsedProfile.error) }, { status: 422 });
      }
      profileDocument = await Hospital.create({ ...parsedProfile.data, userId: user._id });
    } else if (role === 'BLOOD_BANK') {
      const parsedProfile = bloodBankProfileSchema.safeParse(profile);
      if (!parsedProfile.success) {
        await User.findByIdAndDelete(user._id); // rollback
        return NextResponse.json({ success: false, message: 'Invalid blood bank profile.', errors: formatZodErrors(parsedProfile.error) }, { status: 422 });
      }
      profileDocument = await BloodBank.create({ ...parsedProfile.data, userId: user._id });

      // Auto-initialize empty inventory slots for all blood group × component combinations.
      // This is idempotent ($setOnInsert won't overwrite existing records).
      // Blood bank operators can then update quantities via the Inventory page.
      try {
        const { Inventory } = await import('@/models/Inventory');
        const BLOOD_GROUPS_LIST = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
        const COMPONENT_TYPES_LIST = ['WHOLE_BLOOD', 'PRBC', 'PLATELETS_RDP', 'PLATELETS_SDP', 'FFP', 'CRYO'] as const;
        const now = new Date();
        const ops = [];
        for (const bg of BLOOD_GROUPS_LIST) {
          for (const ct of COMPONENT_TYPES_LIST) {
            ops.push({
              updateOne: {
                filter: { bloodBankId: profileDocument._id, bloodGroup: bg, component: ct },
                update: {
                  $setOnInsert: {
                    bloodBankId: profileDocument._id, bloodGroup: bg, component: ct,
                    availableUnits: 0, reservedUnits: 0, totalUnits: 0,
                    status: 'UNAVAILABLE' as const, operationallyUnavailable: false, lastUpdated: now,
                  },
                },
                upsert: true,
              },
            });
          }
        }
        await Inventory.bulkWrite(ops);
      } catch (invErr) {
        // Inventory init is best-effort — don't fail registration if it errors
        console.error('[register] Failed to auto-init inventory:', invErr);
      }
    } else {
      const parsedProfile = donorProfileSchema.safeParse(profile);
      if (!parsedProfile.success) {
        await User.findByIdAndDelete(user._id); // rollback
        return NextResponse.json({ success: false, message: 'Invalid donor profile.', errors: formatZodErrors(parsedProfile.error) }, { status: 422 });
      }
      // Ensure isAvailable matches availabilityStatus
      const availabilityStatus = parsedProfile.data.availabilityStatus || 'AVAILABLE';
      profileDocument = await Donor.create({
        ...parsedProfile.data,
        userId: user._id,
        availabilityStatus,
        isAvailable: availabilityStatus === 'AVAILABLE',
      });
    }

    // Link profile to user
    user.profileId = profileDocument._id;
    await user.save();

    // Create verification record
    await Verification.create({
      userId: user._id,
      entityType: role,
      status: verificationStatus,
    });

    await createAuditLog({
      userId: user._id.toString(),
      userRole: role,
      userName: user.name,
      action: 'REGISTRATION',
      entityType: 'USER',
      entityId: user._id.toString(),
      description: `New ${role} account registered: ${normalizedEmail} (status=${verificationStatus})`,
      newState: { status: verificationStatus, entityType: role },
    });

    // Sign auth cookies so the client is immediately logged in after registration
    // (allows AuthContext.refreshUser() to succeed)
    const accessToken = await signAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
      verificationStatus: user.verificationStatus,
    });
    const refreshToken = await signRefreshToken({
      userId: user._id.toString(),
    });
    await setAuthCookies(accessToken, refreshToken);

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
      { success: false, message: 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
}
