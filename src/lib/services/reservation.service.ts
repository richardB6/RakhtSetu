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
import { reserveUnits, releaseReservation } from '@/lib/services/inventory.service';

export async function reserveAcceptedMatch(matchId: string, actor: { userId: string; userName: string }) {
  await connectToDatabase();
  const match = await Match.findById(matchId);
  if (!match) throw new Error('Match not found');
  if (!['ACCEPTED', 'RESERVED'].includes(match.status)) throw new Error('Only an accepted match can be reserved');

  const request = await EmergencyRequest.findById(match.emergencyRequestId);
  if (!request) throw new Error('Emergency request not found');

  const existing = await Reservation.findOne({ emergencyRequestId: request._id, matchId: match._id });
  if (existing) return existing;

  if (match.resourceType === 'DONOR') {
    const donor = await Donor.findOneAndUpdate(
      { _id: match.resourceId, isAvailable: true, availabilityStatus: { $nin: ['UNAVAILABLE', 'TEMPORARILY_UNAVAILABLE'] }, emergencyNotificationsEnabled: true },
      { $set: { isAvailable: false, availabilityStatus: 'TEMPORARILY_UNAVAILABLE' } },
      { new: true }
    );
    if (!donor) throw new Error('Donor is no longer operationally available');
    let reservation;
    try {
      reservation = await Reservation.create({
        emergencyRequestId: request._id,
        matchId: match._id,
        donorId: donor._id,
        resourceUserId: match.resourceUserId,
        units: 1,
        status: 'ACTIVE',
      });
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      reservation = await Reservation.findOne({ emergencyRequestId: request._id, matchId: match._id });
      if (!reservation) throw error;
    }
    match.reservedQuantity = 1;
    match.status = 'RESERVED';
    await match.save();
    return reservation;
  }

  const bloodBank = await BloodBank.findById(match.resourceId);
  if (!bloodBank || bloodBank.operationalStatus === 'UNAVAILABLE' || bloodBank.operationalStatus === 'CLOSED') {
    throw new Error('Blood bank is no longer operationally available');
  }

  const inventory = await Inventory.findOne({
    bloodBankId: bloodBank._id,
    component: request.component,
    bloodGroup: { $in: getCompatibleDonorGroups(request.bloodGroup as BloodGroup, request.component as ComponentType) },
    availableUnits: { $gte: Math.max(1, request.quantity - request.quantityFulfilled) },
    operationallyUnavailable: { $ne: true },
    status: { $ne: 'UNAVAILABLE' },
  });
  if (!inventory) throw new Error('Required inventory is no longer available');

  const units = Math.max(1, request.quantity - request.quantityFulfilled);
  const updatedInventory = await reserveUnits(
    bloodBank._id.toString(),
    inventory.bloodGroup as BloodGroup,
    request.component as ComponentType,
    units,
    actor,
    { emergencyRequestId: request._id.toString(), matchId: match._id.toString() }
  );

  let reservation;
  try {
    reservation = await Reservation.create({
      emergencyRequestId: request._id,
      matchId: match._id,
      inventoryId: updatedInventory._id,
      bloodBankId: bloodBank._id,
      resourceUserId: match.resourceUserId,
      units,
      status: 'ACTIVE',
    });
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    await releaseReservation(
      bloodBank._id.toString(),
      inventory.bloodGroup as BloodGroup,
      request.component as ComponentType,
      units,
      actor,
      { emergencyRequestId: request._id.toString(), matchId: match._id.toString(), reason: 'DUPLICATE_RESERVATION_COMPENSATION' }
    );
    reservation = await Reservation.findOne({ emergencyRequestId: request._id, matchId: match._id });
    if (!reservation) throw error;
  }
  match.reservedQuantity = units;
  match.status = 'RESERVED';
  await match.save();
  await createAuditLog({
    userId: actor.userId,
    userRole: 'SYSTEM',
    userName: actor.userName,
    action: 'RESERVATION_CREATED',
    entityType: 'Reservation',
    entityId: reservation._id.toString(),
    description: `Reserved ${units} units for emergency request ${request.requestId}`,
    newState: reservation.toObject(),
  });
  await createNotification({
    userId: request.createdBy.toString(),
    type: 'MATCH_ACCEPTED',
    title: 'Resource reserved',
    message: `${units} units have been reserved for request ${request.requestId}.`,
    severity: request.severity,
    referenceType: 'RESERVATION',
    referenceId: reservation._id.toString(),
  });
  return reservation;
}

export async function releaseRequestReservations(
  emergencyRequestId: string,
  reason: string,
  actor: { userId: string; userName: string }
) {
  await connectToDatabase();
  const reservations = await Reservation.find({ emergencyRequestId, status: 'ACTIVE' });
  for (const reservation of reservations) {
    if (reservation.inventoryId && reservation.bloodBankId) {
      const inventory = await Inventory.findById(reservation.inventoryId);
      if (inventory) {
        await releaseReservation(
          reservation.bloodBankId.toString(),
          inventory.bloodGroup as BloodGroup,
          inventory.component as ComponentType,
          reservation.units,
          actor,
          { emergencyRequestId, matchId: reservation.matchId.toString(), reason }
        );
      }
    }
    if (reservation.donorId) {
      await Donor.findOneAndUpdate(
        { _id: reservation.donorId },
        { $set: { isAvailable: true, availabilityStatus: 'AVAILABLE' } }
      );
    }
    reservation.status = reason === 'FULFILLED' ? 'FULFILLED' : 'RELEASED';
    reservation.releaseReason = reason;
    reservation.releasedAt = new Date();
    await reservation.save();
    await Match.findByIdAndUpdate(reservation.matchId, {
      $set: { status: reason === 'FULFILLED' ? 'FULFILLED' : 'CANCELLED' },
    });
  }
  return reservations;
}

export async function releaseMatchReservation(
  matchId: string,
  reason: string,
  actor: { userId: string; userName: string }
) {
  await connectToDatabase();
  const reservation = await Reservation.findOne({ matchId, status: 'ACTIVE' });
  if (!reservation) return null;
  if (reservation.inventoryId && reservation.bloodBankId) {
    const inventory = await Inventory.findById(reservation.inventoryId);
    if (inventory) {
      await releaseReservation(
        reservation.bloodBankId.toString(),
        inventory.bloodGroup as BloodGroup,
        inventory.component as ComponentType,
        reservation.units,
        actor,
        { emergencyRequestId: reservation.emergencyRequestId.toString(), matchId, reason }
      );
    }
  }
  if (reservation.donorId) {
    await Donor.findOneAndUpdate({ _id: reservation.donorId }, { $set: { isAvailable: true, availabilityStatus: 'AVAILABLE' } });
  }
  reservation.status = 'RELEASED';
  reservation.releaseReason = reason;
  reservation.releasedAt = new Date();
  await reservation.save();
  await Match.findByIdAndUpdate(matchId, { $set: { status: 'CANCELLED' } });
  return reservation;
}

export async function fulfillRequestReservations(
  emergencyRequestId: string,
  actor: { userId: string; userName: string }
) {
  await connectToDatabase();
  const reservations = await Reservation.find({ emergencyRequestId, status: 'ACTIVE' });
  for (const reservation of reservations) {
    if (reservation.inventoryId) {
      const inventory = await Inventory.findById(reservation.inventoryId);
      if (inventory) {
        const previous = {
          availableUnits: inventory.availableUnits,
          reservedUnits: inventory.reservedUnits,
          totalUnits: inventory.totalUnits,
          status: inventory.status,
          operationallyUnavailable: inventory.operationallyUnavailable,
        };
        const updated = await Inventory.findOneAndUpdate(
          { _id: inventory._id, reservedUnits: { $gte: reservation.units } },
          {
            $inc: { reservedUnits: -reservation.units, totalUnits: -reservation.units },
            $set: {
              lastUpdated: new Date(),
              status: inventory.operationallyUnavailable || inventory.availableUnits <= 0
                ? 'UNAVAILABLE'
                : inventory.reservedUnits - reservation.units > 0
                  ? 'RESERVED'
                  : 'AVAILABLE',
            },
          },
          { new: true }
        );
        if (!updated) throw new Error('Fulfillment could not consume the reserved inventory');
        await InventoryHistory.create({
          inventoryId: updated._id,
          bloodBankId: reservation.bloodBankId,
          actorId: actor.userId,
          action: 'INVENTORY_FULFILLED',
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
        });
      }
    }
    reservation.status = 'FULFILLED';
    reservation.releaseReason = 'FULFILLED';
    reservation.releasedAt = new Date();
    await reservation.save();
    await Match.findByIdAndUpdate(reservation.matchId, { $set: { status: 'FULFILLED' } });
  }
  return reservations;
}

export async function getReservationForMatch(emergencyRequestId: string, matchId: string) {
  await connectToDatabase();
  return Reservation.findOne({ emergencyRequestId, matchId });
}
