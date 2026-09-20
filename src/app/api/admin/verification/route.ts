import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { connectToDatabase } from '@/lib/db/mongodb';
import { User } from '@/models/User';
import { Verification } from '@/models/Verification';
import { createAuditLog } from '@/lib/services/audit.service';
import { z } from 'zod';

const verificationUpdateSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED']),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

export const GET = withAuth(async (req) => {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const q = searchParams.get('q');

    const query: Record<string, any> = {};
    if (status && status !== 'ALL') query.status = status;

    const verificationEntries = await Verification.find(query).sort({ updatedAt: -1 }).lean();
    const userIds = verificationEntries.map((entry) => entry.userId);
    const users = await User.find({ _id: { $in: userIds } }).select('_id name email role verificationStatus createdAt').lean();
    const userMap = new Map(users.map((user) => [user._id.toString(), user]));

    const payload = verificationEntries
      .map((entry) => {
        const user = userMap.get(entry.userId.toString());
        if (!user) return null;
        const matches = !q ? true : `${user.name} ${user.email} ${user.role} ${user._id.toString()}`.toLowerCase().includes(q.toLowerCase());
        return matches ? { ...entry, user, submittedDocuments: entry.submittedDocuments || [], createdAt: entry.createdAt, updatedAt: entry.updatedAt } : null;
      })
      .filter(Boolean);

    return NextResponse.json({ success: true, data: payload });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}, { roles: ['ADMIN'] });

export const PATCH = withAuth(async (req, context) => {
  try {
    const body = await req.json();
    const parsed = verificationUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: 'Invalid verification action', errors: parsed.error.flatten() }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findById(parsed.data.userId);
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    const previousState = { verificationStatus: user.verificationStatus };
    const verification = await Verification.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          status: parsed.data.status,
          verifiedBy: context.user.userId,
          verifiedAt: new Date(),
          rejectionReason: parsed.data.status === 'REJECTED' ? parsed.data.reason || 'Not provided' : undefined,
          suspensionReason: parsed.data.status === 'SUSPENDED' ? parsed.data.reason || 'Not provided' : undefined,
          notes: parsed.data.notes || '',
        },
        $setOnInsert: {
          entityType: user.role,
          submittedDocuments: [],
        },
      },
      { upsert: true, new: true }
    );

    user.verificationStatus = parsed.data.status;
    await user.save();

    await createAuditLog({
      userId: context.user.userId,
      userRole: 'ADMIN',
      userName: context.user.name,
      action: parsed.data.status === 'VERIFIED' ? 'VERIFICATION_APPROVED' : parsed.data.status === 'REJECTED' ? 'VERIFICATION_REJECTED' : 'VERIFICATION_SUSPENDED',
      entityType: 'VERIFICATION',
      entityId: verification._id.toString(),
      description: `Set verification status for ${user.name} to ${parsed.data.status}`,
      previousState,
      newState: { verificationStatus: parsed.data.status, verificationId: verification._id.toString() },
    });

    return NextResponse.json({ success: true, data: { user, verification } });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}, { roles: ['ADMIN'] });
