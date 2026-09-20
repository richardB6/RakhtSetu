import { connectToDatabase } from '@/lib/db/mongodb';
import { Inventory, InventoryStatus } from '@/models/Inventory';
import { BloodGroup, ComponentType } from '@/lib/engine/compatibility';
import { createAuditLog } from '@/lib/services/audit.service';

export function validateInventoryState(input: {
  availableUnits: number;
  reservedUnits: number;
}) {
  if (!Number.isFinite(input.availableUnits) || input.availableUnits < 0) {
    throw new Error('Inventory available quantity must be a non-negative number.');
  }

  if (!Number.isFinite(input.reservedUnits) || input.reservedUnits < 0) {
    throw new Error('Inventory reserved quantity must be a non-negative number.');
  }

  if (input.reservedUnits > input.availableUnits) {
    throw new Error('Inventory reserved quantity cannot exceed available stock.');
  }

  return true;
}

export function reserveInventoryUnits(state: { availableUnits: number; reservedUnits: number }, units: number) {
  if (!Number.isFinite(units) || units <= 0) {
    throw new Error('Reservation quantity must be greater than zero.');
  }

  validateInventoryState(state);

  if (state.availableUnits < units) {
    throw new Error('Insufficient inventory to reserve the requested quantity.');
  }

  return {
    availableUnits: state.availableUnits - units,
    reservedUnits: state.reservedUnits + units,
  };
}

export function releaseInventoryReservation(state: { availableUnits: number; reservedUnits: number }, units: number) {
  if (!Number.isFinite(units) || units <= 0) {
    throw new Error('Release quantity must be greater than zero.');
  }

  validateInventoryState(state);

  if (state.reservedUnits < units) {
    throw new Error('Cannot release more reserved units than currently reserved.');
  }

  return {
    availableUnits: state.availableUnits + units,
    reservedUnits: state.reservedUnits - units,
  };
}

export async function getInventory(bloodBankId: string) {
  await connectToDatabase();
  return await Inventory.find({ bloodBankId }).sort({ bloodGroup: 1, component: 1 });
}

export async function updateInventory(
  bloodBankId: string,
  bloodGroup: BloodGroup,
  component: ComponentType,
  availableUnits: number,
  reservedUnits: number = 0,
  options: { actor?: string; actorName?: string; notes?: string; requestId?: string } = {}
) {
  await connectToDatabase();

  const safeAvailable = Number(availableUnits);
  const safeReserved = Number(reservedUnits);
  validateInventoryState({ availableUnits: safeAvailable, reservedUnits: safeReserved });

  const existing = await Inventory.findOne({ bloodBankId, bloodGroup, component });
  const previous = existing ? { availableUnits: existing.availableUnits, reservedUnits: existing.reservedUnits, status: existing.status } : null;

  const updated = await Inventory.findOneAndUpdate(
    { bloodBankId, bloodGroup, component },
    {
      $set: {
        availableUnits: safeAvailable,
        reservedUnits: safeReserved,
        lastUpdated: new Date(),
        status: safeAvailable <= 0 ? 'UNAVAILABLE' : safeReserved > 0 ? 'RESERVED' : 'AVAILABLE',
        ...(options.notes ? { notes: options.notes } : {}),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  if (options.actor) {
    await createAuditLog({
      userId: options.actor,
      userRole: 'BLOOD_BANK',
      userName: options.actorName || 'Blood Bank',
      action: 'UPDATE_INVENTORY',
      entityType: 'INVENTORY',
      entityId: updated._id.toString(),
      description: `Updated ${bloodGroup} ${component} inventory`,
      previousState: previous,
      newState: { availableUnits: safeAvailable, reservedUnits: safeReserved, status: updated.status },
      metadata: options.requestId ? { userAgent: options.requestId } : undefined,
    });
  }

  return updated;
}

export async function reserveUnits(
  bloodBankId: string,
  bloodGroup: BloodGroup,
  component: ComponentType,
  units: number,
  actor?: { userId: string; userName: string; requestId?: string }
) {
  await connectToDatabase();

  const item = await Inventory.findOne({ bloodBankId, bloodGroup, component });
  if (!item) throw new Error('Inventory item not found');

  const previous = { availableUnits: item.availableUnits, reservedUnits: item.reservedUnits, status: item.status };
  const nextState = reserveInventoryUnits({ availableUnits: item.availableUnits, reservedUnits: item.reservedUnits }, units);
  const updated = await Inventory.findOneAndUpdate(
    {
      bloodBankId,
      bloodGroup,
      component,
      availableUnits: { $gte: units },
      reservedUnits: { $lte: item.availableUnits - units },
    },
    {
      $set: {
        availableUnits: nextState.availableUnits,
        reservedUnits: nextState.reservedUnits,
        lastUpdated: new Date(),
        status: nextState.availableUnits <= 0 ? 'UNAVAILABLE' : nextState.reservedUnits > 0 ? 'RESERVED' : 'AVAILABLE',
      },
    },
    { new: true }
  );

  if (!updated) {
    throw new Error('Reservation failed because inventory changed before the update could be applied.');
  }

  if (actor) {
    await createAuditLog({
      userId: actor.userId,
      userRole: 'BLOOD_BANK',
      userName: actor.userName,
      action: 'RESERVE_INVENTORY',
      entityType: 'INVENTORY',
      entityId: updated._id.toString(),
      description: `Reserved ${units} ${bloodGroup} ${component} units`,
      previousState: previous,
      newState: { availableUnits: updated.availableUnits, reservedUnits: updated.reservedUnits, status: updated.status },
      metadata: actor.requestId ? { userAgent: actor.requestId } : undefined,
    });
  }

  return updated;
}

export async function releaseReservation(
  bloodBankId: string,
  bloodGroup: BloodGroup,
  component: ComponentType,
  units: number,
  actor?: { userId: string; userName: string; requestId?: string }
) {
  await connectToDatabase();

  const item = await Inventory.findOne({ bloodBankId, bloodGroup, component });
  if (!item) throw new Error('Inventory item not found');

  const previous = { availableUnits: item.availableUnits, reservedUnits: item.reservedUnits, status: item.status };
  const nextState = releaseInventoryReservation({ availableUnits: item.availableUnits, reservedUnits: item.reservedUnits }, units);
  const updated = await Inventory.findOneAndUpdate(
    {
      bloodBankId,
      bloodGroup,
      component,
      reservedUnits: { $gte: units },
    },
    {
      $set: {
        availableUnits: nextState.availableUnits,
        reservedUnits: nextState.reservedUnits,
        lastUpdated: new Date(),
        status: nextState.availableUnits <= 0 ? 'UNAVAILABLE' : nextState.reservedUnits > 0 ? 'RESERVED' : 'AVAILABLE',
      },
    },
    { new: true }
  );

  if (!updated) {
    throw new Error('Reservation release failed because inventory was no longer eligible.');
  }

  if (actor) {
    await createAuditLog({
      userId: actor.userId,
      userRole: 'BLOOD_BANK',
      userName: actor.userName,
      action: 'RELEASE_RESERVATION',
      entityType: 'INVENTORY',
      entityId: updated._id.toString(),
      description: `Released ${units} reserved ${bloodGroup} ${component} units`,
      previousState: previous,
      newState: { availableUnits: updated.availableUnits, reservedUnits: updated.reservedUnits, status: updated.status },
      metadata: actor.requestId ? { userAgent: actor.requestId } : undefined,
    });
  }

  return updated;
}

export async function getAvailableInventory(
  bloodGroup: BloodGroup,
  component: ComponentType,
  minUnits: number = 1
) {
  await connectToDatabase();

  return await Inventory.find({
    bloodGroup,
    component,
    availableUnits: { $gte: minUnits },
    status: { $ne: 'UNAVAILABLE' },
  }).populate('bloodBankId');
}

export async function bulkUpdateInventory(
  bloodBankId: string,
  items: Array<{ bloodGroup: BloodGroup; component: ComponentType; availableUnits: number }>
) {
  await connectToDatabase();

  const operations = items.map((item) => ({
    updateOne: {
      filter: { bloodBankId, bloodGroup: item.bloodGroup, component: item.component },
      update: {
        $set: {
          availableUnits: item.availableUnits,
          reservedUnits: 0,
          lastUpdated: new Date(),
          status: (item.availableUnits <= 0 ? 'UNAVAILABLE' : 'AVAILABLE') as InventoryStatus,
        },
      },
      upsert: true,
    },
  }));

  if (operations.length > 0) {
    return await Inventory.bulkWrite(operations);
  }

  return null;
}
