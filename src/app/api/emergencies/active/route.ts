import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { connectToDatabase } from '@/lib/db/mongodb';
import { EmergencyRequest } from '@/models/EmergencyRequest';
import { Donor } from '@/models/Donor';
import { BloodBank } from '@/models/BloodBank';
import { Inventory } from '@/models/Inventory';
import { ACTIVE_STATUSES } from '@/lib/engine/compatibility';

/**
 * GET /api/emergencies/active
 *
 * Returns active emergency requests relevant to the authenticated user:
 * - DONOR: requests compatible with the donor's blood group and within radius
 * - BLOOD_BANK: requests compatible with any blood group in inventory
 * - HOSPITAL: all active requests (for the command center overview)
 *
 * Newly registered accounts can call this endpoint to discover existing active
 * requests even if they were not notified at the time of creation.
 */
export const GET = withAuth(async (req, context) => {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const skip = (page - 1) * limit;

    let matchQuery: Record<string, unknown> = {
      status: { $in: ACTIVE_STATUSES },
      requiredBy: { $gt: new Date() },
    };

    if (context.user.role === 'DONOR') {
      // Find donor profile
      const donor = await Donor.findOne({ userId: context.user.userId });
      if (!donor) {
        return NextResponse.json(
          { success: false, message: 'Donor profile not found.' },
          { status: 404 }
        );
      }

      if (!donor.isAvailable || donor.availabilityStatus === 'UNAVAILABLE') {
        return NextResponse.json({
          success: true,
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
          message: 'No active requests shown: your availability is set to unavailable.',
        });
      }

      // Get compatible blood groups for this donor
      // Donors can donate to compatible recipients — we show requests where the
      // requested blood group is compatible with the donor's blood group
      const compatibleRecipientGroups = getCompatibileRecipientGroups(donor.bloodGroup);

      matchQuery = {
        ...matchQuery,
        bloodGroup: { $in: compatibleRecipientGroups },
      };
    } else if (context.user.role === 'BLOOD_BANK') {
      // Find blood bank and its available inventory
      const bloodBank = await BloodBank.findOne({ userId: context.user.userId });
      if (!bloodBank) {
        return NextResponse.json(
          { success: false, message: 'Blood bank profile not found.' },
          { status: 404 }
        );
      }

      const inventory = await Inventory.find({
        bloodBankId: bloodBank._id,
        availableUnits: { $gt: 0 },
        operationallyUnavailable: { $ne: true },
      }).select('bloodGroup component');

      const availableGroups = [...new Set(inventory.map((i) => i.bloodGroup))];
      const availableComponents = [...new Set(inventory.map((i) => i.component))];

      if (availableGroups.length === 0) {
        return NextResponse.json({
          success: true,
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
          message: 'No active requests shown: no available inventory.',
        });
      }

      matchQuery = {
        ...matchQuery,
        bloodGroup: { $in: availableGroups },
        component: { $in: availableComponents },
      };
    }
    // HOSPITAL and ADMIN: see all active requests

    const [requests, total] = await Promise.all([
      EmergencyRequest.find(matchQuery)
        .sort({ severity: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('hospitalId', 'name city state address')
        .lean(),
      EmergencyRequest.countDocuments(matchQuery),
    ]);

    return NextResponse.json({
      success: true,
      data: requests,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('[GET /api/emergencies/active] Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch active requests.' },
      { status: 500 }
    );
  }
}, { roles: ['DONOR', 'HOSPITAL', 'BLOOD_BANK', 'ADMIN'] });

/**
 * Given a donor's blood group, return the recipient blood groups they can donate to.
 * This is the reverse of the "compatible donor groups" lookup used in matching.
 */
function getCompatibileRecipientGroups(donorBloodGroup: string): string[] {
  const donationMap: Record<string, string[]> = {
    'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    'O+': ['O+', 'A+', 'B+', 'AB+'],
    'A-': ['A-', 'A+', 'AB-', 'AB+'],
    'A+': ['A+', 'AB+'],
    'B-': ['B-', 'B+', 'AB-', 'AB+'],
    'B+': ['B+', 'AB+'],
    'AB-': ['AB-', 'AB+'],
    'AB+': ['AB+'],
  };
  return donationMap[donorBloodGroup] || [donorBloodGroup];
}
