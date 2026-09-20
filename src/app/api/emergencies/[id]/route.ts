import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { getEmergencyById, updateEmergencyStatus } from '@/lib/services/emergency.service';
import { updateEmergencyStatusSchema } from '@/lib/validations/emergency.schema';

export const GET = withAuth(async (req, context) => {
  try {
    const id = Array.isArray(context.params.id) ? context.params.id[0] : context.params.id;
    const result = await getEmergencyById(id);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 404 });
  }
});

export const PATCH = withAuth(async (req, context) => {
  try {
    const id = Array.isArray(context.params.id) ? context.params.id[0] : context.params.id;
    const body = await req.json();
    const validatedData = updateEmergencyStatusSchema.parse(body);

    const result = await updateEmergencyStatus(
      id,
      validatedData.status as any,
      context.user.userId,
      validatedData.cancellationReason
    );
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ success: false, errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}, { roles: ['HOSPITAL', 'ADMIN'] });
