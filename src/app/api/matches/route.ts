import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Match } from '@/models/Match';
import { BloodBank } from '@/models/BloodBank';
import { Donor } from '@/models/Donor';
import { Inventory } from '@/models/Inventory';
import {
  escalateMatchIfInsufficientStock,
  recoverStaleMatchingRequests,
} from '@/lib/services/matching.service';
import { getCompatibleDonorGroups, BloodGroup, ComponentType } from '@/lib/engine/compatibility';
import { getCompatibleAvailableUnits } from '@/lib/engine/inventory-policy';

/**
 * GET /api/matches
 *
 * Returns matches addressed to the current user's resource (blood bank or donor).
 * - BLOOD_BANK: matches where resourceUserId === current user
 * - DONOR: matches where resourceUserId === current user
 * - ADMIN: all matches (optional filter by ?emergencyId=)
 *
 * Query params:
 *   status   — filter by match status; comma-separated values are supported
 *   limit    — default 20, max 50
 *   page     — default 1
 */
export const GET = withAuth(async (req, context) => {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status');
    const limitParam = Math.min(50, parseInt(searchParams.get('limit') || '20'));
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const skip = (page - 1) * limitParam;
    const emergencyId = searchParams.get('emergencyId');

    if (context.user.role === 'BLOOD_BANK') {
      await recoverStaleMatchingRequests();
    }

    const query: Record<string, unknown> = {};

    if (context.user.role === 'BLOOD_BANK' || context.user.role === 'DONOR') {
      query.resourceUserId = context.user.userId;
    }

    if (statusParam) {
      const statuses = statusParam.split(',').filter(Boolean);
      query.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
    }

    if (emergencyId) {
      query.emergencyRequestId = emergencyId;
    }

    const [matches, total] = await Promise.all([
      Match.find(query)
        .populate('emergencyRequestId', 'requestId bloodGroup component quantity quantityFulfilled severity status city requiredBy createdAt contactPerson contactPhone')
        .populate('resourceUserId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitParam)
        .lean(),
      Match.countDocuments(query),
    ]);

    // Enrich with resource name if not already populated
    const enriched = await Promise.all(
      matches.map(async (match) => {
        let resourceName = 'Unknown';
        let availableQuantity = match.availableQuantity;
        let status = match.status;
        let declineReason = match.declineReason;
        if (match.resourceType === 'BLOOD_BANK') {
          const emergency = match.emergencyRequestId;
          if (
            emergency &&
            typeof emergency === 'object' &&
            'bloodGroup' in emergency &&
            'component' in emergency &&
            typeof emergency.bloodGroup === 'string' &&
            typeof emergency.component === 'string'
          ) {
            const compatibleGroups = getCompatibleDonorGroups(
              emergency.bloodGroup as BloodGroup,
              emergency.component as ComponentType
            );
            const inventory = await Inventory.find({
              bloodBankId: match.resourceId,
              bloodGroup: { $in: compatibleGroups },
              component: emergency.component,
              operationallyUnavailable: { $ne: true },
              status: { $ne: 'UNAVAILABLE' },
            }).select('bloodGroup component availableUnits status operationallyUnavailable').lean();
            availableQuantity = getCompatibleAvailableUnits(
              inventory,
              compatibleGroups,
              emergency.component
            );
          }
          if (
            context.user.role === 'BLOOD_BANK' &&
            (match.status === 'PENDING' || match.status === 'NOTIFIED')
          ) {
            const declinedMatch = await escalateMatchIfInsufficientStock(
              match._id.toString(),
              context.user.userId
            );
            if (declinedMatch) {
              status = 'DECLINED';
              declineReason = declinedMatch.declineReason;
            }
          }
        }
        try {
          if (match.resourceType === 'BLOOD_BANK') {
            const bb = await BloodBank.findById(match.resourceId).select('name city').lean();
            if (bb) resourceName = `${bb.name} (${bb.city})`;
          } else if (match.resourceType === 'DONOR') {
            const donor = await Donor.findById(match.resourceId).select('city bloodGroup').lean();
            if (donor) resourceName = `Donor — ${donor.bloodGroup} (${donor.city})`;
          }
        } catch {
          // ignore
        }
        return { ...match, status, declineReason, availableQuantity, resourceName };
      })
    );

    return NextResponse.json({
      success: true,
      data: enriched,
      total,
      page,
      limit: limitParam,
      totalPages: Math.ceil(total / limitParam),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to load matches' },
      { status: 500 }
    );
  }
}, { roles: ['BLOOD_BANK', 'DONOR', 'ADMIN'] });
