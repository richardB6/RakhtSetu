import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Donor } from '@/models/Donor';
import { User } from '@/models/User';

/**
 * GET /api/donors
 *
 * Donor directory for ADMIN and BLOOD_BANK.
 * Supports filtering by bloodGroup, availability, and text search.
 * Blood banks receive only available-donor coordination data; personal fields
 * are restricted to ADMIN.
 *
 * Query params:
 *   bloodGroup  — e.g. 'A+', 'O-', or omit for all
 *   availability — 'available' | 'unavailable' | omit for all
 *   search      — free-text: city, state, or donor name
 *   page        — default 1
 *   limit       — default 24, max 100
 */
export const GET = withAuth(async (req: NextRequest, context) => {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const bloodGroupParam = searchParams.get('bloodGroup') ?? '';
    const availabilityParam = searchParams.get('availability') ?? '';
    const searchParam = (searchParams.get('search') ?? searchParams.get('q') ?? '').trim();
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '24')));
    const skip = (page - 1) * limit;

    const isAdmin = context.user.role === 'ADMIN';
    const isBloodBank = context.user.role === 'BLOOD_BANK';
    const query: Record<string, unknown> = {};

    if (isBloodBank) {
      query.isAvailable = true;
      query.availabilityStatus = 'AVAILABLE';
      query.emergencyNotificationsEnabled = true;
    }

    // Blood group filter
    if (bloodGroupParam && bloodGroupParam !== 'all') {
      query.bloodGroup = bloodGroupParam;
    }

    // Availability filter — full server-side, unlike the old /api/search workaround
    if (availabilityParam === 'available') {
      query.isAvailable = true;
    } else if (availabilityParam === 'unavailable') {
      query.isAvailable = false;
    }

    // Text search: match city, state, or donor's user name
    if (searchParam) {
      const searchConditions: Record<string, unknown>[] = [
        { city: { $regex: searchParam, $options: 'i' } },
        { state: { $regex: searchParam, $options: 'i' } },
      ];
      if (isAdmin) {
        const matchingUsers = await User.find({
          name: { $regex: searchParam, $options: 'i' },
          role: 'DONOR',
        }).select('_id').lean();
        searchConditions.push({ userId: { $in: matchingUsers.map((u) => u._id) } });
      }
      query.$or = searchConditions;
    }

    const userFields = isAdmin ? 'name email phone verificationStatus' : '_id';
    const [donors, total] = await Promise.all([
      Donor.find(query)
        .sort({ isAvailable: -1, totalDonations: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', userFields)
        .lean(),
      Donor.countDocuments(query),
    ]);

    const formatted = (donors as any[]).map((d) => ({
      _id: String(d._id),
      ...(isAdmin ? {
        userId: {
          name: d.userId?.name ?? 'Anonymous Donor',
          email: d.userId?.email ?? null,
          phone: d.userId?.phone ?? null,
          verificationStatus: d.userId?.verificationStatus ?? 'PENDING',
        },
        totalDonations: d.totalDonations ?? 0,
        lastDonationDate: d.lastDonationDate ?? null,
        emergencyNotificationsEnabled: d.emergencyNotificationsEnabled ?? true,
        gender: d.gender ?? null,
      } : {}),
      bloodGroup: d.bloodGroup,
      isAvailable: d.isAvailable ?? false,
      availabilityStatus: d.availabilityStatus ?? (d.isAvailable ? 'AVAILABLE' : 'UNAVAILABLE'),
      availabilityRadius: d.availabilityRadius ?? 10,
      city: d.city ?? '',
      state: d.state ?? '',
    }));

    // Per-blood-group availability summary for the grid header
    const groupStatsRaw = await Donor.aggregate([
      ...(isBloodBank ? [{ $match: { isAvailable: true, availabilityStatus: 'AVAILABLE', emergencyNotificationsEnabled: true } }] : []),
      { $group: { _id: '$bloodGroup', total: { $sum: 1 }, available: { $sum: { $cond: ['$isAvailable', 1, 0] } } } },
    ]);
    const groupStats: Record<string, { total: number; available: number }> = {};
    for (const item of groupStatsRaw) {
      if (item._id) groupStats[item._id] = { total: item.total, available: item.available };
    }

    return NextResponse.json({
      success: true,
      data: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      groupStats,
    });
  } catch (error: any) {
    console.error('[GET /api/donors] Error:', error);
    return NextResponse.json(
      { success: false, message: error.message ?? 'Failed to fetch donor network.' },
      { status: 500 }
    );
  }
}, { roles: ['ADMIN', 'BLOOD_BANK'] });
