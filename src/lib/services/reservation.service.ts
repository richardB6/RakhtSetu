import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db/mongodb';
import { EmergencyRequest } from '@/models/EmergencyRequest';
import { Match } from '@/models/Match';
import { Reservation } from '@/models/Reservation';
import { BloodBank } from '@/models/BloodBank';
import { Donor } from '@/models/Donor';
import { Inventory } from '@/models/Inventory';
import { InventoryHistory } from '@/models/InventoryHistory';
import { createAuditLog } from '@/lib/services/audit.service';
import { createNotification } from '@/lib/services/notification.service';
import { getCompatibleDonorGroups, BloodGroup, ComponentType } from '@/lib/engine/compatibility';
import { getCompatibleAvailableUnits, planCompatibleInventoryReservation } from '@/lib/engine/inventory-policy';
import { reserveUnits, releaseReservation } from '@/lib/services/inventory.service';

export class InsufficientStockError extends Error {
  constructor(message = 'Cannot accept — insufficient stock') {
    super(message);
    this.name = 'InsufficientStockError';
  }
}

function getInventoryAllocations(reservation: InstanceType<typeof Reservation>) {
  if (reservation.inventoryAllocations?.length) return reservation.inventoryAllocations;
  return reservation.inventoryId ? [{ inventoryId: reservation.inventoryId, units: reservation.units }] : [];
}

async function reserveAcceptedMatchInTransaction(
  matchId: string,
  actor: { userId: string; userName: string },
  session: mongoose.ClientSession
) {
  const match = await Match.findById(matchId).session(session);
  if (!match) throw new Error('Match not found');
  if (!['ACCEPTED', 'RESERVED'].includes(match.status)) throw new Error('Only an accepted match can be reserved');

  const request = await EmergencyRequest.findById(match.emergencyRequestId).session(session);
  if (!request) throw new Error('Emergency request not found');

  const existing = await Reservation.findOne({ emergencyRequestId: request._id, matchId: match._id }).session(session);
  if (existing) return { reservation: existing, created: false };

  if (match.resourceType === 'DONOR') {
    const donorProfile = await Donor.findOne({
      _id: match.resourceId,
      isAvailable: true,
      availabilityStatus: { $nin: ['UNAVAILABLE', 'TEMPORARILY_UNAVAILABLE'] },
      emergencyNotificationsEnabled: true,
    }).session(session);
    if (!donorProfile) throw new Error('Donor is no longer operationally available');
    const donor = await Donor.findOneAndUpdate(
      { _id: match.resourceId, isAvailable: true, availabilityStatus: { $nin: ['UNAVAILABLE', 'TEMPORARILY_UNAVAILABLE'] }, emergencyNotificationsEnabled: true },
      { $set: { isAvailable: false, availabilityStatus: 'TEMPORARILY_UNAVAILABLE' } },
      { new: true, session }
    );
    if (!donor) throw new Error('Donor is no longer operationally available');
    const reservation = new Reservation({
      emergencyRequestId: request._id,
      matchId: match._id,
      donorId: donor._id,
      donorAvailabilityStatusBeforeReservation: donorProfile.availabilityStatus,
      donorAvailabilityLockUpdatedAt: donor.updatedAt,
      resourceUserId: match.resourceUserId,
      units: 1,
      status: 'ACTIVE',
    });
    await reservation.save({ session });
    match.reservedQuantity = 1;
    match.status = 'RESERVED';
    await match.save({ session });
    return { reservation, created: true };
  }

  const bloodBank = await BloodBank.findById(match.resourceId).session(session);
  if (!bloodBank || bloodBank.operationalStatus === 'UNAVAILABLE' || bloodBank.operationalStatus === 'CLOSED') {
    throw new Error('Blood bank is no longer operationally available');
  }

  const compatibleGroups = getCompatibleDonorGroups(request.bloodGroup as BloodGroup, request.component as ComponentType);
  const units = Math.max(1, request.quantity - request.quantityFulfilled);
  const inventoryItems = await Inventory.find({
    bloodBankId: bloodBank._id,
    component: request.component,
    bloodGroup: { $in: compatibleGroups },
    availableUnits: { $gt: 0 },
    operationallyUnavailable: { $ne: true },
    status: { $ne: 'UNAVAILABLE' },
  }).session(session);
  const availableQuantity = getCompatibleAvailableUnits(inventoryItems, compatibleGroups, request.component);
  if (availableQuantity < units) {
    throw new InsufficientStockError(
      `Cannot accept — insufficient stock (${availableQuantity} of ${units} compatible units available)`
    );
  }

  const allocations = planCompatibleInventoryReservation(inventoryItems, compatibleGroups, request.component, units);
  const reservedAllocations = [];
  for (const allocation of allocations) {
    const updatedInventory = await reserveUnits(
      bloodBank._id.toString(),
      allocation.item.bloodGroup as BloodGroup,
      request.component as ComponentType,
      allocation.units,
      actor,
      { emergencyRequestId: request._id.toString(), matchId: match._id.toString() },
      session
    );
    reservedAllocations.push({ inventoryId: updatedInventory._id, units: allocation.units });
  }

  const reservation = new Reservation({
    emergencyRequestId: request._id,
    matchId: match._id,
    inventoryId: reservedAllocations[0].inventoryId,
    inventoryAllocations: reservedAllocations,
    bloodBankId: bloodBank._id,
    resourceUserId: match.resourceUserId,
    units,
    status: 'ACTIVE',
  });
  await reservation.save({ session });
  match.reservedQuantity = units;
  match.status = 'RESERVED';
  await match.save({ session });
  return { reservation, created: true };
}

export async function notifyReservationCreated(
  reservation: InstanceType<typeof Reservation>,
  actor: { userId: string; userName: string }
) {
  const request = await EmergencyRequest.findById(reservation.emergencyRequestId);
  if (!request) throw new Error('Emergency request not found');
  await createAuditLog({
    userId: actor.userId,
    userRole: 'SYSTEM',
    userName: actor.userName,
    action: 'RESERVATION_CREATED',
    entityType: 'Reservation',
    entityId: reservation._id.toString(),
    description: `Reserved ${reservation.units} units for emergency request ${request.requestId}`,
    newState: reservation.toObject(),
  });
  await createNotification({
    userId: request.createdBy.toString(),
    type: 'MATCH_ACCEPTED',
    title: 'Resource reserved',
    message: `${reservation.units} units have been reserved for request ${request.requestId}.`,
    severity: request.severity,
    referenceType: 'RESERVATION',
    referenceId: reservation._id.toString(),
  });
}

export async function reserveAcceptedMatch(
  matchId: string,
  actor: { userId: string; userName: string },
  session?: mongoose.ClientSession
) {
  await connectToDatabase();
  if (session) return (await reserveAcceptedMatchInTransaction(matchId, actor, session)).reservation;

  const transaction = await mongoose.startSession();
  let result: Awaited<ReturnType<typeof reserveAcceptedMatchInTransaction>> | undefined;
  try {
    await transaction.withTransaction(async () => {
      result = await reserveAcceptedMatchInTransaction(matchId, actor, transaction);
    });
  } finally {
    await transaction.endSession();
  }
  if (!result) throw new Error('Reservation transaction did not complete');
  if (result.created && result.reservation.bloodBankId) {
    await notifyReservationCreated(result.reservation, actor);
  }
  return result.reservation;
}

export async function releaseRequestReservations(
  emergencyRequestId: string,
  reason: string,
  actor: { userId: string; userName: string }
) {
  await connectToDatabase();
  const session = await mongoose.startSession();
  let reservations: InstanceType<typeof Reservation>[] = [];
  try {
    await session.withTransaction(async () => {
      reservations = await Reservation.find({ emergencyRequestId, status: 'ACTIVE' }).session(session);
      for (const reservation of reservations) {
        await releaseReservationInTransaction(reservation, reason, actor, session);
      }
    });
  } finally {
    await session.endSession();
  }
  return reservations;
}

export async function releaseMatchReservation(
  matchId: string,
  reason: string,
  actor: { userId: string; userName: string }
) {
  await connectToDatabase();
  const session = await mongoose.startSession();
  let reservation: InstanceType<typeof Reservation> | null = null;
  try {
    await session.withTransaction(async () => {
      reservation = await Reservation.findOne({ matchId, status: 'ACTIVE' }).session(session);
      if (reservation) await releaseReservationInTransaction(reservation, reason, actor, session, true);
    });
  } finally {
    await session.endSession();
  }
  return reservation;
}

async function releaseReservationInTransaction(
  reservation: InstanceType<typeof Reservation>,
  reason: string,
  actor: { userId: string; userName: string },
  session: mongoose.ClientSession,
  cancelMatch = false
) {
  if (reservation.bloodBankId) {
    for (const allocation of getInventoryAllocations(reservation)) {
      const inventory = await Inventory.findById(allocation.inventoryId).session(session);
      if (!inventory) throw new Error('Reserved inventory item could not be found during release');
      await releaseReservation(
        reservation.bloodBankId.toString(),
        inventory.bloodGroup as BloodGroup,
        inventory.component as ComponentType,
        allocation.units,
        actor,
        {
          emergencyRequestId: reservation.emergencyRequestId.toString(),
          matchId: reservation.matchId.toString(),
          reason,
        },
        session
      );
    }
  }
  if (reservation.donorId) {
    await Donor.findOneAndUpdate(
      {
        _id: reservation.donorId,
        availabilityStatus: 'TEMPORARILY_UNAVAILABLE',
        ...(reservation.donorAvailabilityLockUpdatedAt ? { updatedAt: reservation.donorAvailabilityLockUpdatedAt } : {}),
      },
      {
        $set: {
          isAvailable: (reservation.donorAvailabilityStatusBeforeReservation || 'AVAILABLE') === 'AVAILABLE',
          availabilityStatus: reservation.donorAvailabilityStatusBeforeReservation || 'AVAILABLE',
        },
      },
      { session }
    );
  }
  reservation.status = 'RELEASED';
  reservation.releaseReason = reason;
  reservation.releasedAt = new Date();
  await reservation.save({ session });
  await Match.findByIdAndUpdate(
    reservation.matchId,
    { $set: { status: reason === 'FULFILLED' && !cancelMatch ? 'FULFILLED' : 'CANCELLED' } },
    { session }
  );
}

export async function fulfillRequestReservations(
  emergencyRequestId: string,
  actor: { userId: string; userName: string },
  session?: mongoose.ClientSession
) {
  await connectToDatabase();
  const reservationsQuery = Reservation.find({ emergencyRequestId, status: 'ACTIVE' });
  if (session) reservationsQuery.session(session);
  const reservations = await reservationsQuery;
  for (const reservation of reservations) {
    const allocations = getInventoryAllocations(reservation);
    for (const allocation of allocations) {
      const inventoryQuery = Inventory.findById(allocation.inventoryId);
      if (session) inventoryQuery.session(session);
      const inventory = await inventoryQuery;
      if (inventory) {
        const previous = {
          availableUnits: inventory.availableUnits,
          reservedUnits: inventory.reservedUnits,
          totalUnits: inventory.totalUnits,
          status: inventory.status,
          operationallyUnavailable: inventory.operationallyUnavailable,
        };
        const updated = await Inventory.findOneAndUpdate(
          { _id: inventory._id, reservedUnits: { $gte: allocation.units } },
          {
            $inc: { reservedUnits: -allocation.units, totalUnits: -allocation.units },
            $set: {
              lastUpdated: new Date(),
              status: inventory.operationallyUnavailable || inventory.availableUnits <= 0
                ? 'UNAVAILABLE'
                : inventory.reservedUnits - allocation.units > 0
                  ? 'RESERVED'
                  : 'AVAILABLE',
            },
          },
          session ? { new: true, session } : { new: true }
        );
        if (!updated) throw new Error('Fulfillment could not consume the reserved inventory');
        const history = {
          inventoryId: updated._id,
          bloodBankId: reservation.bloodBankId,
          actorId: actor.userId,
          action: 'INVENTORY_FULFILLED' as const,
          previousState: previous,
          newState: {
            availableUnits: updated.availableUnits,
            reservedUnits: updated.reservedUnits,
            totalUnits: updated.totalUnits,
            status: updated.status,
            operationallyUnavailable: updated.operationallyUnavailable,
          },
          emergencyRequestId,
          matchId: reservation.matchId,
          reason: 'FULFILLED',
        };
        if (session) await InventoryHistory.create([history], { session });
        else await InventoryHistory.create(history);
      }
    }
    reservation.status = 'FULFILLED';
    reservation.releaseReason = 'FULFILLED';
    reservation.releasedAt = new Date();
    if (session) await reservation.save({ session });
    else await reservation.save();
    await Match.findByIdAndUpdate(
      reservation.matchId,
      { $set: { status: 'FULFILLED' } },
      session ? { session } : {}
    );
  }
  return reservations;
}

export async function getReservationForMatch(emergencyRequestId: string, matchId: string) {
  await connectToDatabase();
  return Reservation.findOne({ emergencyRequestId, matchId });
}
