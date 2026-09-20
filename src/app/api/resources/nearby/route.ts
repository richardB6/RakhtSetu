import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { connectToDatabase } from '@/lib/db/mongodb';
import { BloodBank } from '@/models/BloodBank';
import { Donor } from '@/models/Donor';

export const GET = withAuth(async (req, context) => {
  try {
    const { searchParams } = new URL(req.url);
    const latStr = searchParams.get('lat');
    const lngStr = searchParams.get('lng');
    const radiusKmStr = searchParams.get('radiusKm') || '10';
    const bloodGroup = searchParams.get('bloodGroup');
    const component = searchParams.get('component');

    if (!latStr || !lngStr) {
      return NextResponse.json({ success: false, message: 'lat and lng are required' }, { status: 400 });
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    const radiusKm = parseFloat(radiusKmStr);

    await connectToDatabase();

    const bloodBankQuery: any = { isOpen: true };
    if (bloodGroup) {
      // Basic filtering, actual inventory filtering requires lookup but this is a simplified version
      // Or we can leave it general.
    }

    const bloodBanks = await BloodBank.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distance',
          maxDistance: radiusKm * 1000,
          spherical: true,
        },
      },
      { $match: bloodBankQuery }
    ]);

    const donorQuery: any = { isAvailable: true };
    if (bloodGroup) donorQuery.bloodGroup = bloodGroup;

    const donors = await Donor.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distance',
          maxDistance: radiusKm * 1000,
          spherical: true,
        },
      },
      { $match: donorQuery }
    ]);

    const resources = [
      ...bloodBanks.map(bb => ({ ...bb, type: 'BLOOD_BANK', distanceKm: bb.distance / 1000 })),
      ...donors.map(d => ({ ...d, type: 'DONOR', distanceKm: d.distance / 1000 }))
    ].sort((a, b) => a.distanceKm - b.distanceKm);

    return NextResponse.json({ success: true, data: resources });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
});
