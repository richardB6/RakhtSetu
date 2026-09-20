import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { getInventory, updateInventory } from '@/lib/services/inventory.service';
import { createAuditLog } from '@/lib/services/audit.service';
import { BloodBank } from '@/models/BloodBank';
import { connectToDatabase } from '@/lib/db/mongodb';

export const GET = withAuth(async (req, context) => {
  try {
    await connectToDatabase();
    let targetBloodBankId = null;

    if (context.user.role === 'BLOOD_BANK') {
      const bloodBank = await BloodBank.findOne({ userId: context.user.userId });
      if (!bloodBank) {
        return NextResponse.json({ success: false, message: 'Blood bank profile not found' }, { status: 404 });
      }
      targetBloodBankId = bloodBank._id.toString();
    } else if (context.user.role === 'ADMIN') {
      const { searchParams } = new URL(req.url);
      targetBloodBankId = searchParams.get('bloodBankId');
      if (!targetBloodBankId) {
        return NextResponse.json({ success: false, message: 'bloodBankId is required for ADMIN' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    const inventory = await getInventory(targetBloodBankId);
    return NextResponse.json({ success: true, data: inventory });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}, { roles: ['BLOOD_BANK', 'ADMIN'] });

export const PATCH = withAuth(async (req, context) => {
  try {
    const body = await req.json();
    const { bloodGroup, component, availableUnits } = body;

    if (!bloodGroup || !component || availableUnits === undefined) {
      return NextResponse.json({ success: false, message: 'bloodGroup, component, and availableUnits are required' }, { status: 400 });
    }

    await connectToDatabase();
    const bloodBank = await BloodBank.findOne({ userId: context.user.userId });
    if (!bloodBank) {
      return NextResponse.json({ success: false, message: 'Blood bank profile not found' }, { status: 404 });
    }

    const result = await updateInventory(bloodBank._id.toString(), bloodGroup, component, availableUnits);

    await createAuditLog({
      userId: context.user.userId,
      userRole: 'BLOOD_BANK',
      userName: bloodBank.name || 'Blood Bank User',
      action: 'UPDATE_INVENTORY',
      entityType: 'INVENTORY',
      entityId: result?._id.toString() || 'unknown',
      description: `Updated inventory for ${bloodGroup} ${component} to ${availableUnits} units`,
      newState: result?.toObject()
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}, { roles: ['BLOOD_BANK'] });
