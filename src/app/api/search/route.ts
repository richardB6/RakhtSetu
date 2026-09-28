import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { connectToDatabase } from '@/lib/db/mongodb';
import { EmergencyRequest } from '@/models/EmergencyRequest';
import { BloodBank } from '@/models/BloodBank';
import { Donor } from '@/models/Donor';
import { Hospital } from '@/models/Hospital';
import { Inventory } from '@/models/Inventory';
import { ACTIVE_STATUSES } from '@/lib/engine/compatibility';

/**
 * GET /api/search?q=<query>&type=<type>
 *
 * Universal search endpoint with role-based scoping.
 * Results are always server-side authorized.
 *
 * Supported types (auto-detected by role if omitted):
 *   - emergencies: search emergency requests
 *   - blood_banks: search blood bank listings
 *   - donors: search donors (hospital/blood_bank/admin only)
 *   - inventory: search inventory records (blood_bank only)
 */
export const GET = withAuth(async (req, context) => {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const typeParam = searchParams.get('type') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get('limit') || '10')));
    const skip = (page - 1) * limit;

    if (!q || q.length < 2) {
      return NextResponse.json({
        success: true,
        results: [],
        total: 0,
        message: 'Query must be at least 2 characters.',
      });
    }

    const role = context.user.role;
    const results: Record<string, unknown[]> = {};
    let total = 0;

    // ─── Emergency Request Search ────────────────────────────────────────────
    const canSearchEmergencies = ['ADMIN', 'HOSPITAL', 'BLOOD_BANK'].includes(role);
    if (canSearchEmergencies && (!typeParam || typeParam === 'emergencies')) {
      const emergencyQuery: Record<string, unknown> = {
        $or: [
          { requestId: { $regex: q, $options: 'i' } },
          { patientReference: { $regex: q, $options: 'i' } },
          { city: { $regex: q, $options: 'i' } },
          { bloodGroup: { $regex: q, $options: 'i' } },
        ],
      };

      // Hospital sees only its own requests
      if (role === 'HOSPITAL') {
        const hospital = await Hospital.findOne({ userId: context.user.userId }).select('_id');
        if (hospital) {
          emergencyQuery.hospitalId = hospital._id;
        }
      }

      // Blood bank sees only active (routable) requests
      if (role === 'BLOOD_BANK') {
        emergencyQuery.status = { $in: ACTIVE_STATUSES };
      }

      const [emergencies, eCount] = await Promise.all([
        EmergencyRequest.find(emergencyQuery)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .select('requestId bloodGroup component quantity severity status city createdAt hospitalId')
          .populate('hospitalId', 'name city')
          .lean(),
        EmergencyRequest.countDocuments(emergencyQuery),
      ]);
      results.emergencies = emergencies;
      total += eCount;
    }

    // ─── Blood Bank Search (all roles can find blood banks) ──────────────────
    if (!typeParam || typeParam === 'blood_banks') {
      const bbQuery = {
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { city: { $regex: q, $options: 'i' } },
          { state: { $regex: q, $options: 'i' } },
          { licenseNumber: { $regex: q, $options: 'i' } },
        ],
      };

      const [bloodBanks, bbCount] = await Promise.all([
        BloodBank.find(bbQuery)
          .sort({ name: 1 })
          .skip(skip)
          .limit(limit)
          .select('name city state address operatingHours operationalStatus isOpen contactPhone componentCapabilities')
          .lean(),
        BloodBank.countDocuments(bbQuery),
      ]);
      results.blood_banks = bloodBanks;
      total += bbCount;
    }

    // ─── Donor Search (hospital, blood_bank, admin only) ─────────────────────
    const canSearchDonors = ['ADMIN', 'HOSPITAL', 'BLOOD_BANK'].includes(role);
    if (canSearchDonors && (!typeParam || typeParam === 'donors')) {
      // Only search available donors; never expose medical history
      const donorQuery: Record<string, unknown> = {
        isAvailable: true,
        $or: [
          { city: { $regex: q, $options: 'i' } },
          { state: { $regex: q, $options: 'i' } },
          { bloodGroup: { $regex: q, $options: 'i' } },
        ],
      };

      const [donors, dCount] = await Promise.all([
        Donor.find(donorQuery)
          .sort({ bloodGroup: 1 })
          .skip(skip)
          .limit(limit)
          // NEVER expose address, dateOfBirth, or detailed medical info
          .select('bloodGroup city state availabilityStatus isAvailable emergencyNotificationsEnabled lastDonationDate')
          .lean(),
        Donor.countDocuments(donorQuery),
      ]);
      results.donors = donors;
      total += dCount;
    }

    // ─── Inventory Search (blood_bank, admin only) ────────────────────────────
    if (['ADMIN', 'BLOOD_BANK'].includes(role) && (!typeParam || typeParam === 'inventory')) {
      const invQuery: Record<string, unknown> = {
        availableUnits: { $gt: 0 },
        $or: [
          { bloodGroup: { $regex: q, $options: 'i' } },
          { component: { $regex: q, $options: 'i' } },
        ],
      };

      // Blood bank sees only its own inventory
      if (role === 'BLOOD_BANK') {
        const bb = await BloodBank.findOne({ userId: context.user.userId }).select('_id');
        if (bb) {
          invQuery.bloodBankId = bb._id;
        }
      }

      const [inventory, invCount] = await Promise.all([
        Inventory.find(invQuery)
          .sort({ bloodGroup: 1, component: 1 })
          .skip(skip)
          .limit(limit)
          .select('bloodGroup component availableUnits reservedUnits status lastUpdated')
          .lean(),
        Inventory.countDocuments(invQuery),
      ]);
      results.inventory = inventory;
      total += invCount;
    }

    return NextResponse.json({
      success: true,
      query: q,
      results,
      total,
      page,
      limit,
    });
  } catch (error: any) {
    console.error('[GET /api/search] Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Search failed.' },
      { status: 500 }
    );
  }
}, { roles: ['DONOR', 'HOSPITAL', 'BLOOD_BANK', 'ADMIN'] });
