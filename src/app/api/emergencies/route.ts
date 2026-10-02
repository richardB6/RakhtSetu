import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { getEmergencyRequests, createEmergencyRequest } from '@/lib/services/emergency.service';
import { createEmergencySchema } from '@/lib/validations/emergency.schema';
import { Hospital } from '@/models/Hospital';
import { connectToDatabase } from '@/lib/db/mongodb';
import { runMatchingEngine } from '@/lib/services/matching.service';
import { EmergencyRequest } from '@/models/EmergencyRequest';
import { Match } from '@/models/Match';
import { BloodBank } from '@/models/BloodBank';

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
    if (context.user.role === 'HOSPITAL' && searchParams.get('includeMatches') === 'true') {
      const requestIds = result.data.map((request) => request._id);
      const acceptedMatches = await Match.find({
        emergencyRequestId: { $in: requestIds },
        resourceType: 'BLOOD_BANK',
        status: { $in: ['ACCEPTED', 'RESERVED', 'FULFILLED'] },
      }).select('emergencyRequestId resourceId status').lean();
      const bloodBankIds = acceptedMatches.map((match) => match.resourceId);
      const bloodBanks = await BloodBank.find({ _id: { $in: bloodBankIds } }).select('name').lean();
      const bloodBankNames = new Map(bloodBanks.map((bloodBank) => [bloodBank._id.toString(), bloodBank.name]));
      const matchedByRequest = new Map<string, Array<{ name: string; status: string }>>();

      for (const match of acceptedMatches) {
        const name = bloodBankNames.get(match.resourceId.toString());
        if (!name) continue;
        const key = match.emergencyRequestId.toString();
        const matches = matchedByRequest.get(key) || [];
        matches.push({ name, status: match.status });
        matchedByRequest.set(key, matches);
      }

      return NextResponse.json({
        success: true,
        ...result,
        data: result.data.map((request) => ({
          ...request,
          matchedBloodBanks: matchedByRequest.get(request._id.toString()) || [],
        })),
      });
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}, { roles: ['ADMIN', 'HOSPITAL', 'BLOOD_BANK'] });

export const POST = withAuth(async (req, context) => {
  try {
    const submissionKey = req.headers.get('idempotency-key');
    if (!submissionKey || !/^[\da-f-]{36}$/i.test(submissionKey)) {
      return NextResponse.json({ success: false, message: 'A valid Idempotency-Key is required to submit this request.' }, { status: 400 });
    }

    const body = await req.json();
    const validatedData = createEmergencySchema.parse(body);
    
    await connectToDatabase();
    const hospital = await Hospital.findOne({ userId: context.user.userId });
    if (!hospital) {
      return NextResponse.json({ success: false, message: 'Hospital profile not found' }, { status: 404 });
    }

    const creation = await createEmergencyRequest(validatedData, hospital._id.toString(), context.user.userId, submissionKey);
    let request = creation.request;

    if (creation.created || (request.status === 'ESCALATED' && request.matchingMessage)) {
      try {
        await runMatchingEngine(request._id.toString(), context.user.userId, false);
      } catch (matchErr) {
        console.error('[Emergency POST] Matching engine error:', matchErr);
        const latestRequest = await EmergencyRequest.findById(request._id);
        if (latestRequest) {
          if (latestRequest.matchCount === 0) latestRequest.status = 'ESCALATED';
          latestRequest.matchingMessage = 'Matching could not complete. Retry matching or contact an administrator.';
          await latestRequest.save();
          request = latestRequest;
        }
      }
      request = (await EmergencyRequest.findById(request._id)) ?? request;
    }

    return NextResponse.json({ success: true, data: request }, { status: creation.created ? 201 : 200 });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ success: false, errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}, { roles: ['HOSPITAL', 'ADMIN'], requireVerified: true });
