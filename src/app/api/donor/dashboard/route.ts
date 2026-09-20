import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { connectToDatabase } from '@/lib/db/mongodb';
import { BloodBank } from '@/models/BloodBank';
import { Donor } from '@/models/Donor';
import { EmergencyRequest } from '@/models/EmergencyRequest';
import { Match } from '@/models/Match';
import { Notification } from '@/models/Notification';
import { User } from '@/models/User';

export const GET = withAuth(async (req: NextRequest, context) => {
  try {
    await connectToDatabase();
    const donor = await Donor.findOne({ userId: context.user.userId }).lean();
    if (!donor) return NextResponse.json({ success: false, message: 'Donor profile not found' }, { status: 404 });

    const donorPoint = {
      type: 'Point' as const,
      coordinates: [Number(donor.location.coordinates[0]), Number(donor.location.coordinates[1])] as [number, number],
    };
    const [user, matches, notifications, nearbyBanks] = await Promise.all([
      User.findById(context.user.userId).select('name email phone verificationStatus profileId').lean(),
      Match.find({ resourceUserId: context.user.userId })
        .populate('emergencyRequestId', 'requestId bloodGroup component quantity severity status requiredBy city createdAt')
        .sort({ updatedAt: -1 })
        .limit(20)
        .lean(),
      Notification.find({ userId: context.user.userId })
        .select('title message severity type isRead createdAt referenceType referenceId')
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      BloodBank.aggregate([
        { $geoNear: { near: donorPoint, distanceField: 'distanceMeters', maxDistance: donor.availabilityRadius * 1000, spherical: true } },
        { $match: { operationalStatus: { $in: ['OPEN', 'LIMITED'] }, isOpen: true } },
        { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $match: { 'user.isActive': true, 'user.verificationStatus': 'VERIFIED' } },
        { $project: { name: 1, address: 1, city: 1, state: 1, operatingHours: 1, operationalStatus: 1, location: 1, distanceMeters: 1 } },
        { $limit: 8 },
      ]),
    ]);

    const requestIds = matches.map((match) => match.emergencyRequestId).filter(Boolean);
    const relevantRequests = await EmergencyRequest.find({ _id: { $in: requestIds } })
      .select('requestId bloodGroup component quantity severity status requiredBy city createdAt')
      .sort({ requiredBy: 1, createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        profile: { ...donor, user },
        availability: {
          status: donor.availabilityStatus,
          radiusKm: donor.availabilityRadius,
          emergencyNotificationsEnabled: donor.emergencyNotificationsEnabled,
          verificationStatus: user?.verificationStatus || 'PENDING',
        },
        requests: relevantRequests,
        matches,
        nearbyBanks: nearbyBanks.map((bank) => ({ ...bank, distanceKm: Number((bank.distanceMeters / 1000).toFixed(1)) })),
        donationHistory: { totalDonations: donor.totalDonations, lastDonationDate: donor.lastDonationDate || null },
        notifications,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Unable to load donor dashboard' }, { status: 500 });
  }
}, { roles: ['DONOR'] });