import { connectToDatabase } from '@/lib/db/mongodb';
import { Inventory, InventoryStatus } from '@/models/Inventory';
import { InventoryHistory, InventoryHistoryAction } from '@/models/InventoryHistory';
import { BloodGroup, ComponentType } from '@/lib/engine/compatibility';
import { getAllocatableInventoryUnits } from '@/lib/engine/inventory-policy';
import { createAuditLog } from '@/lib/services/audit.service';
export { validateInventoryState, reserveInventoryUnits, releaseInventoryReservation } from '@/lib/engine/inventory-policy';
import { validateInventoryState, reserveInventoryUnits, releaseInventoryReservation } from '@/lib/engine/inventory-policy';

export async function findAllocatableInventory(
  bloodBankId: string,
  bloodGroup: BloodGroup,
  component: ComponentType,
  session?: import('mongoose').ClientSession
) {
  await connectToDatabase();
  const query = Inventory.findOne({
    bloodBankId,
    bloodGroup,
    component,
    availableUnits: { $gt: 0 },
    reservedUnits: { $gte: 0 },
    totalUnits: { $gte: 0 },
    operationallyUnavailable: { $ne: true },
    status: { $in: ['AVAILABLE', 'RESERVED'] },
  });
  if (session) query.session(session);
  return query;
}

export { getAllocatableInventoryUnits };

export async function getInventory(bloodBankId?: string) {
  await connectToDatabase();
  return await Inventory.find(bloodBankId ? { bloodBankId } : {}).sort({ bloodGroup: 1, component: 1 });
}

function inventoryState(item: { availableUnits: number; reservedUnits: number; totalUnits: number; status: InventoryStatus; operationallyUnavailable: boolean }) {
  return {
    availableUnits: item.availableUnits,
    reservedUnits: item.reservedUnits,
    totalUnits: item.totalUnits,
    status: item.status,
    operationallyUnavailable: item.operationallyUnavailable,
  };
}

async function recordInventoryHistory(data: {
  inventoryId: string;
  bloodBankId: string;
  actorId?: string;
  action: InventoryHistoryAction;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  emergencyRequestId?: string;
  matchId?: string;
  reason?: string;
}, session?: import('mongoose').ClientSession) {
  if (session) await InventoryHistory.create([data], { session });
  else await InventoryHistory.create(data);
}

export async function updateInventory(
  bloodBankId: string,
  bloodGroup: BloodGroup,
  component: ComponentType,
  availableUnits: number,
  reservedUnits: number = 0,
  options: { actor?: string; actorName?: string; notes?: string; requestId?: string; operationallyUnavailable?: boolean } = {}
) {
  await connectToDatabase();

  const safeAvailable = Number(availableUnits);
  const safeReserved = Number(reservedUnits);
  validateInventoryState({ availableUnits: safeAvailable, reservedUnits: safeReserved });

  const existing = await Inventory.findOne({ bloodBankId, bloodGroup, component });
  const previous = existing ? inventoryState(existing) : undefined;
  const operationallyUnavailable = options.operationallyUnavailable ?? existing?.operationallyUnavailable ?? false;

  const updated = await Inventory.findOneAndUpdate(
    { bloodBankId, bloodGroup, component },
    {
      $set: {
        availableUnits: safeAvailable,
        reservedUnits: safeReserved,
        totalUnits: safeAvailable + safeReserved,
        lastUpdated: new Date(),
        operationallyUnavailable,
        status: operationallyUnavailable || safeAvailable <= 0 ? 'UNAVAILABLE' : safeReserved > 0 ? 'RESERVED' : 'AVAILABLE',
        ...(options.notes ? { notes: options.notes } : {}),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  await recordInventoryHistory({
    inventoryId: updated._id.toString(),
    bloodBankId,
    actorId: options.actor,
    action: previous ? 'INVENTORY_UPDATED' : 'INVENTORY_CREATED',
    previousState: previous,
    newState: inventoryState(updated),
  });

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
  actor?: { userId: string; userName: string; requestId?: string },
  scope?: { emergencyRequestId: string; matchId: string },
  session?: import('mongoose').ClientSession
) {
  await connectToDatabase();

  const itemQuery = Inventory.findOne({ bloodBankId, bloodGroup, component });
  if (session) itemQuery.session(session);
  const item = await itemQuery;
  if (!item) throw new Error('Inventory item not found');

  const previous = { availableUnits: item.availableUnits, reservedUnits: item.reservedUnits, status: item.status };
  reserveInventoryUnits({ availableUnits: item.availableUnits, reservedUnits: item.reservedUnits, totalUnits: item.totalUnits }, units);
  const updated = await Inventory.findOneAndUpdate(
    {
      bloodBankId,
      bloodGroup,
      component,
      availableUnits: { $gte: units },
      operationallyUnavailable: { $ne: true },
      status: { $in: ['AVAILABLE', 'RESERVED'] },
    },
    {
      $inc: { availableUnits: -units, reservedUnits: units },
      $set: { lastUpdated: new Date() },
    },
    session ? { new: true, session } : { new: true }
  );

  if (!updated) {
    await recordInventoryHistory({
      inventoryId: item._id.toString(),
      bloodBankId,
      actorId: actor?.userId,
      action: 'RESERVATION_FAILED',
      previousState: previous,
      reason: 'Inventory changed before the conditional reservation update completed.',
      emergencyRequestId: scope?.emergencyRequestId,
      matchId: scope?.matchId,
    }, session);
    throw new Error('Reservation failed because inventory changed before the update could be applied.');
  }
  updated.status = updated.availableUnits <= 0 ? 'UNAVAILABLE' : updated.reservedUnits > 0 ? 'RESERVED' : 'AVAILABLE';
  if (session) await updated.save({ session });
  else await updated.save();

  await recordInventoryHistory({
    inventoryId: updated._id.toString(),
    bloodBankId,
    actorId: actor?.userId,
    action: 'INVENTORY_RESERVED',
    previousState: previous,
    newState: inventoryState(updated),
    emergencyRequestId: scope?.emergencyRequestId,
    matchId: scope?.matchId,
  }, session);

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
    }, session);
  }

  return updated;
}

export async function releaseReservation(
  bloodBankId: string,
  bloodGroup: BloodGroup,
  component: ComponentType,
  units: number,
  actor?: { userId: string; userName: string; requestId?: string },
  scope?: { emergencyRequestId?: string; matchId?: string; reason?: string },
  session?: import('mongoose').ClientSession
) {
  await connectToDatabase();

  const itemQuery = Inventory.findOne({ bloodBankId, bloodGroup, component });
  if (session) itemQuery.session(session);
  const item = await itemQuery;
  if (!item) throw new Error('Inventory item not found');

  const previous = { availableUnits: item.availableUnits, reservedUnits: item.reservedUnits, status: item.status };
  releaseInventoryReservation({ availableUnits: item.availableUnits, reservedUnits: item.reservedUnits, totalUnits: item.totalUnits }, units);
  const updated = await Inventory.findOneAndUpdate(
    {
      bloodBankId,
      bloodGroup,
      component,
      reservedUnits: { $gte: units },
    },
    { $inc: { availableUnits: units, reservedUnits: -units }, $set: { lastUpdated: new Date() } },
    session ? { new: true, session } : { new: true }
  );

  if (!updated) {
    throw new Error('Reservation release failed because inventory was no longer eligible.');
  }
  updated.status = updated.availableUnits <= 0 ? 'UNAVAILABLE' : updated.reservedUnits > 0 ? 'RESERVED' : 'AVAILABLE';
  if (session) await updated.save({ session });
  else await updated.save();

  await recordInventoryHistory({
    inventoryId: updated._id.toString(),
    bloodBankId,
    actorId: actor?.userId,
    action: 'INVENTORY_RELEASED',
    previousState: previous,
    newState: inventoryState(updated),
    emergencyRequestId: scope?.emergencyRequestId,
    matchId: scope?.matchId,
    reason: scope?.reason,
  }, session);

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
    }, session);
  }

  return updated;
}

export async function setInventoryAvailability(
  bloodBankId: string,
  bloodGroup: BloodGroup,
  component: ComponentType,
  operationallyUnavailable: boolean,
  actor?: { userId: string; userName: string }
) {
  await connectToDatabase();
  const item = await Inventory.findOne({ bloodBankId, bloodGroup, component });
  if (!item) throw new Error('Inventory item not found');
  const previous = inventoryState(item);
  item.operationallyUnavailable = operationallyUnavailable;
  item.lastUpdated = new Date();
  await item.save();
  await recordInventoryHistory({
    inventoryId: item._id.toString(),
    bloodBankId,
    actorId: actor?.userId,
    action: operationallyUnavailable ? 'INVENTORY_MARKED_UNAVAILABLE' : 'INVENTORY_RESTORED',
    previousState: previous,
    newState: inventoryState(item),
  });
  return item;
}

export async function getInventoryHistory(bloodBankId?: string, inventoryId?: string) {
  await connectToDatabase();
  return InventoryHistory.find({
    ...(bloodBankId ? { bloodBankId } : {}),
    ...(inventoryId ? { inventoryId } : {}),
  }).sort({ createdAt: -1 }).limit(200);
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
          totalUnits: item.availableUnits,
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
