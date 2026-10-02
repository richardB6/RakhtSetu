import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { confirmBloodReceipt, DeliveryWorkflowError } from '@/lib/services/delivery.service';

export const POST = withAuth(async (_req, context) => {
  try {
    const id = Array.isArray(context.params.id) ? context.params.id[0] : context.params.id;
    const result = await confirmBloodReceipt(id, context.user.userId);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof DeliveryWorkflowError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    console.error('[Receipt POST] Failed to confirm blood delivery:', error);
    return NextResponse.json({ success: false, message: 'Unable to confirm blood receipt.' }, { status: 500 });
  }
}, { roles: ['HOSPITAL'], requireVerified: true });