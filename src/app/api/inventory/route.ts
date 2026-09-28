import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { getInventory, getInventoryHistory, updateInventory } from '@/lib/services/inventory.service';
import { BloodBank } from '@/models/BloodBank';
import { Inventory } from '@/models/Inventory';
import { connectToDatabase } from '@/lib/db/mongodb';
import { z } from 'zod';

const inventoryPatchSchema = z.object({
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  component: z.enum(['WHOLE_BLOOD', 'PRBC', 'PLATELETS_RDP', 'PLATELETS_SDP', 'FFP', 'CRYO']),
  availableUnits: z.number().int().min(0),
  notes: z.string().max(500).optional(),
  operationallyUnavailable: z.boolean().optional(),
});

async function getOwnedBloodBank(userId: string) {
  const bloodBank = await BloodBank.findOne({ userId });
  if (!bloodBank) throw new Error('Blood bank profile not found');
  return bloodBank;
}

export const GET = withAuth(async (req, context) => {
  try {
    await connectToDatabase();
    let targetBloodBankId = null;

    if (context.user.role === 'BLOOD_BANK') {
      targetBloodBankId = (await getOwnedBloodBank(context.user.userId))._id.toString();
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
    const history = new URL(req.url).searchParams.get('history');
    if (history === 'true') {
      return NextResponse.json({ success: true, data: await getInventoryHistory(targetBloodBankId) });
    }
    return NextResponse.json({ success: true, data: inventory });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}, { roles: ['BLOOD_BANK', 'ADMIN'] });

export const PATCH = withAuth(async (req, context) => {
  try {
    const parsed = inventoryPatchSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid inventory update', errors: parsed.error.flatten() }, { status: 400 });
    const { bloodGroup, component, availableUnits, notes, operationallyUnavailable } = parsed.data;

    await connectToDatabase();
    const bloodBank = await getOwnedBloodBank(context.user.userId);
    const existing = await Inventory.findOne({ bloodBankId: bloodBank._id, bloodGroup, component });
    if (existing && availableUnits < existing.reservedUnits) {
      return NextResponse.json({ success: false, message: 'Available units cannot be lower than reserved units.' }, { status: 409 });
    }

    const result = await updateInventory(bloodBank._id.toString(), bloodGroup, component, availableUnits, existing?.reservedUnits || 0, {
      actor: context.user.userId,
      actorName: bloodBank.name || context.user.name,
      notes,
      operationallyUnavailable,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}, { roles: ['BLOOD_BANK'] });

/**
 * POST /api/inventory
 * Initialize all blood group × component slots with 0 units for this blood bank.
 * Idempotent — existing records are NOT overwritten.
 * Blood bank operators can then set actual quantities via PATCH.
 */
export const POST = withAuth(async (_req, context) => {
  try {
    await connectToDatabase();
    const bloodBank = await getOwnedBloodBank(context.user.userId);

    const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
    const COMPONENT_TYPES = ['WHOLE_BLOOD', 'PRBC', 'PLATELETS_RDP', 'PLATELETS_SDP', 'FFP', 'CRYO'] as const;

    const now = new Date();
    const operations = [];

    for (const bloodGroup of BLOOD_GROUPS) {
      for (const component of COMPONENT_TYPES) {
        operations.push({
          updateOne: {
            filter: { bloodBankId: bloodBank._id, bloodGroup, component },
            update: {
              $setOnInsert: {
                bloodBankId: bloodBank._id,
                bloodGroup,
                component,
                availableUnits: 0,
                reservedUnits: 0,
                totalUnits: 0,
                status: 'UNAVAILABLE' as const,
                operationallyUnavailable: false,
                lastUpdated: now,
              },
            },
            upsert: true,
          },
        });
      }
    }

    const result = await Inventory.bulkWrite(operations);
    const created = result.upsertedCount;
    const existing = BLOOD_GROUPS.length * COMPONENT_TYPES.length - created;

    return NextResponse.json({
      success: true,
      message: `Inventory initialized. ${created} new slot(s) created, ${existing} existing slot(s) unchanged.`,
      data: { created, unchanged: existing },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}, { roles: ['BLOOD_BANK'] });
