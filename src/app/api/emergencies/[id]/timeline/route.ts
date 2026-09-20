import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { getEmergencyById } from '@/lib/services/emergency.service';
import { getEntityTimeline } from '@/lib/services/audit.service';
import { Escalation } from '@/models/Escalation';
import { connectToDatabase } from '@/lib/db/mongodb';

export const GET = withAuth(async (_req, context) => {
  const id = Array.isArray(context.params.id) ? context.params.id[0] : context.params.id;
  const request = await getEmergencyById(id);
  if (context.user.role === 'HOSPITAL' && request.createdBy.toString() !== context.user.userId) {
    return NextResponse.json({ success: false, message: 'You do not have access to this request.' }, { status: 403 });
  }
  const timeline = await getEntityTimeline('EmergencyRequest', request._id.toString());
  await connectToDatabase();
  const escalations = await Escalation.find({ emergencyRequestId: request._id }).sort({ createdAt: 1 }).lean();
  const events = [
    ...timeline.map((event) => ({ ...event.toObject(), eventType: 'AUDIT' })),
    ...escalations.map((event) => ({
      ...event,
      eventType: 'ESCALATION',
      action: event.type,
      description: event.triggerDetails,
    })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return NextResponse.json({ success: true, data: events });
});
