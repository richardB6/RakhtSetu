import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { connectToDatabase } from '@/lib/db/mongodb';
import { BloodBank } from '@/models/BloodBank';
import { Donor } from '@/models/Donor';
import { EmergencyRequest } from '@/models/EmergencyRequest';
import { Match } from '@/models/Match';
import { Hospital } from '@/models/Hospital';
import { getCompatibleDonorGroups, BloodGroup, ComponentType } from '@/lib/engine/compatibility';

const RADII = [10, 25, 50, 100];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

function validCoordinate(value: number, min: number, max: number) {
  return Number.isFinite(value) && value >= min && value <= max;
}

export const GET = withAuth(async (req, context) => {
  try {
    const params = new URL(req.url).searchParams;
    let lat = Number(params.get('lat'));
    let lng = Number(params.get('lng'));
    const emergencyId = params.get('emergencyId');
    let bloodGroup = params.get('bloodGroup');
    let component = params.get('component');
    const requestedRadius = Number(params.get('radiusKm') || 10);
    const radiusKm = RADII.find((radius) => radius >= requestedRadius) || RADII[RADII.length - 1];

    await connectToDatabase();
    if (emergencyId) {
      const emergency = await EmergencyRequest.findById(emergencyId).select('location bloodGroup component');
      if (!emergency) {
        return NextResponse.json({ success: false, message: 'Emergency request not found' }, { status: 404 });
      }
      if (context.user.role === 'HOSPITAL') {
        const hospital = await Hospital.findOne({ userId: context.user.userId }).select('_id');
        const owned = await EmergencyRequest.exists({
          _id: emergencyId,
          createdBy: context.user.userId,
          hospitalId: hospital?._id,
        });
        if (!owned) {
          return NextResponse.json({ success: false, message: 'You do not have access to this request' }, { status: 403 });
        }
      } else if (context.user.role === 'BLOOD_BANK') {
        const relatedMatch = await Match.exists({
          emergencyRequestId: emergencyId,
          resourceUserId: context.user.userId,
        });
        if (!relatedMatch) {
          return NextResponse.json({ success: false, message: 'You do not have access to this request' }, { status: 403 });
        }
      }
      if (emergency?.location?.coordinates?.length === 2) {
        [lng, lat] = emergency.location.coordinates;
      }
      if (emergency) {
        bloodGroup = bloodGroup || emergency.bloodGroup;
        component = component || emergency.component;
      }
    }
    if (!validCoordinate(lat, -90, 90) || !validCoordinate(lng, -180, 180)) {
      return NextResponse.json({ success: false, message: 'A valid location or emergencyId is required' }, { status: 400 });
    }

    const near = { type: 'Point' as const, coordinates: [lng, lat] as [number, number] };
    const compatibleGroups = bloodGroup && BLOOD_GROUPS.includes(bloodGroup as (typeof BLOOD_GROUPS)[number]) && component
      ? getCompatibleDonorGroups(bloodGroup as BloodGroup, component as ComponentType)
      : undefined;
    const bankMatch: Record<string, unknown> = { isOpen: true, operationalStatus: { $nin: ['UNAVAILABLE', 'CLOSED'] } };
    if (component) bankMatch.componentCapabilities = component;
    const donorMatch: Record<string, unknown> = { isAvailable: true, availabilityStatus: { $nin: ['UNAVAILABLE', 'TEMPORARILY_UNAVAILABLE'] }, emergencyNotificationsEnabled: true };
    if (compatibleGroups?.length) donorMatch.bloodGroup = { $in: compatibleGroups };

    const [banks, donors] = await Promise.all([
      BloodBank.aggregate([
        { $geoNear: { near, distanceField: 'distanceMeters', maxDistance: radiusKm * 1000, spherical: true } },
        { $match: bankMatch },
        { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
        { $match: { 'user.verificationStatus': 'VERIFIED', 'user.isActive': true } },
        { $lookup: { from: 'inventories', let: { bankId: '$_id' }, pipeline: [
          { $match: { $expr: { $eq: ['$bloodBankId', '$$bankId'] } } },
          ...(compatibleGroups?.length ? [{ $match: { bloodGroup: { $in: compatibleGroups } } }] : []),
          ...(component ? [{ $match: { component } }] : []),
          { $match: { availableUnits: { $gt: 0 }, operationallyUnavailable: { $ne: true }, status: { $ne: 'UNAVAILABLE' } } },
          { $project: { _id: 0, bloodGroup: 1, component: 1, availableUnits: 1, lastUpdated: 1, lastVerified: 1 } },
        ], as: 'inventory' } },
      ]),
      Donor.aggregate([
        { $geoNear: { near, distanceField: 'distanceMeters', maxDistance: radiusKm * 1000, spherical: true } },
        { $match: donorMatch },
        { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $match: { 'user.verificationStatus': 'VERIFIED' } },
        { $project: { userId: 1, bloodGroup: 1, location: 1, city: 1, state: 1, isAvailable: 1, totalDonations: 1, acceptedResponseCount: 1, distanceMeters: 1, 'user.name': 1, 'user.verificationStatus': 1 } },
      ]),
    ]);

    const resources = [
      ...banks.map((bank) => {
        const availableQuantity = (bank.inventory || [])
          .filter((item: { availableUnits?: number }) => (item.availableUnits || 0) > 0)
          .reduce((sum: number, item: { availableUnits?: number }) => sum + (item.availableUnits || 0), 0);
        const verified = bank.user?.verificationStatus === 'VERIFIED';
        return {
          id: bank._id.toString(), type: 'BLOOD_BANK', name: bank.name, bloodGroup,
          component, lat: bank.location.coordinates[1], lng: bank.location.coordinates[0],
          address: bank.address, city: bank.city, operatingHours: bank.operatingHours,
          availability: bank.isOpen ? 'AVAILABLE' : 'UNAVAILABLE', availableQuantity,
          distanceKm: Number((bank.distanceMeters / 1000).toFixed(1)), isVerified: verified,
          verificationLabel: verified ? 'Licensed' : 'Verification pending',
          score: Math.round(Math.min(100, 60 + (verified ? 20 : 0) + Math.min(20, availableQuantity))),
          inventory: bank.inventory,
        };
      }),
      ...donors.map((donor) => {
        const verified = donor.user?.verificationStatus === 'VERIFIED';
        const score = Math.round(Math.min(100, 45 + (verified ? 25 : 0) + Math.min(20, donor.totalDonations || 0) + (donor.isAvailable ? 10 : 0)));
        return {
          id: donor._id.toString(), type: 'DONOR', name: donor.user?.name || 'Verified donor',
          bloodGroup: donor.bloodGroup, lat: donor.location.coordinates[1], lng: donor.location.coordinates[0],
          address: donor.city, availability: donor.isAvailable ? 'AVAILABLE' : 'UNAVAILABLE',
          availableQuantity: 1, distanceKm: Number((donor.distanceMeters / 1000).toFixed(1)),
          isVerified: verified, verificationLabel: verified ? 'Identity verified' : 'Verification pending',
          score, totalDonations: donor.totalDonations || 0,
        };
      }),
    ].sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm);

    const radiusIndex = RADII.indexOf(radiusKm);
    return NextResponse.json({
      success: true, data: resources, meta: {
        center: { lat, lng }, radiusKm, requestedRadiusKm: requestedRadius,
        radiusState: resources.length ? 'FOUND' : radiusIndex < RADII.length - 1 ? 'EXPAND_AVAILABLE' : 'NO_RESULTS',
        nextRadiusKm: resources.length || radiusIndex === RADII.length - 1 ? null : RADII[radiusIndex + 1],
        availableCount: resources.filter((resource) => resource.availability === 'AVAILABLE').length,
        source: 'mongodb',
      },
    });
  } catch (error) {
    console.error('[nearby-resources]', error);
    return NextResponse.json({ success: false, message: 'Unable to locate nearby resources' }, { status: 500 });
  }
}, { roles: ['ADMIN', 'HOSPITAL', 'BLOOD_BANK'] });
