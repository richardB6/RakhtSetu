import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { getEmergencyRequests, createEmergencyRequest } from '@/lib/services/emergency.service';
import { createEmergencySchema } from '@/lib/validations/emergency.schema';
import { Hospital } from '@/models/Hospital';
import { connectToDatabase } from '@/lib/db/mongodb';

export const GET = withAuth(async (req, context) => {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const severity = searchParams.get('severity') as any;
    const bloodGroup = searchParams.get('bloodGroup');
    const component = searchParams.get('component');
    const hospitalId = searchParams.get('hospitalId');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const filters: any = { page, limit };
    if (status) filters.status = status.includes(',') ? status.split(',') : status;
    if (severity) filters.severity = severity;
    if (bloodGroup) filters.bloodGroup = bloodGroup;
    if (component) filters.component = component;
    if (hospitalId) filters.hospitalId = hospitalId;
    if (search) filters.search = search;
    if (context.user.role === 'HOSPITAL') {
      const hospital = await Hospital.findOne({ userId: context.user.userId }).select('_id');
      if (!hospital) return NextResponse.json({ success: false, message: 'Hospital profile not found' }, { status: 404 });
      filters.hospitalId = hospital._id.toString();
    }

    const result = await getEmergencyRequests(filters);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
});

export const POST = withAuth(async (req, context) => {
  try {
    const body = await req.json();
    const validatedData = createEmergencySchema.parse(body);
    
    await connectToDatabase();
    const hospital = await Hospital.findOne({ userId: context.user.userId });
    if (!hospital) {
      return NextResponse.json({ success: false, message: 'Hospital profile not found' }, { status: 404 });
    }

    const result = await createEmergencyRequest(validatedData, hospital._id.toString(), context.user.userId);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ success: false, errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}, { roles: ['HOSPITAL', 'ADMIN'] });
