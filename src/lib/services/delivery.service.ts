import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db/mongodb';
import { BloodBank } from '@/models/BloodBank';
import { EmergencyRequest } from '@/models/EmergencyRequest';
import { Hospital } from '@/models/Hospital';
import { Match } from '@/models/Match';
import { Reservation } from '@/models/Reservation';
import { createNotification } from '@/lib/services/notification.service';
import { fulfillRequestReservations } from '@/lib/services/reservation.service';

export class DeliveryWorkflowError extends Error {
  constructor(message: string, readonly status: 403 | 404 | 409) {
    super(message);
    this.name = 'DeliveryWorkflowError';
  }
}

export async function confirmBloodReceipt(requestId: string, hospitalUserId: string) {
  await connectToDatabase();
  const session = await mongoose.startSession();
  let result: {
    requestId: string;
    status: 'FULFILLED';
    fulfilledAt: Date;
    alreadyReceived: boolean;
  } | undefined;

  try {
    await session.withTransaction(async () => {
      const hospital = await Hospital.findOne({ userId: hospitalUserId }).select('_id name').session(session);
      if (!hospital) throw new DeliveryWorkflowError('Hospital profile not found.', 404);

      const requestQuery = mongoose.Types.ObjectId.isValid(requestId)
        ? { _id: requestId }
        : { requestId };
      const request = await EmergencyRequest.findOne(requestQuery).session(session);
      if (!request) throw new DeliveryWorkflowError('Emergency request not found.', 404);
      if (request.hospitalId.toString() !== hospital._id.toString()) {
        throw new DeliveryWorkflowError('You do not have access to this request.', 403);
      }

      const matchQuery: Record<string, unknown> = {
        emergencyRequestId: request._id,
        resourceType: 'BLOOD_BANK',
        status: { $in: ['ACCEPTED', 'RESERVED', 'FULFILLED'] },
      };
      if (request.selectedMatchId) matchQuery._id = request.selectedMatchId;
      const bloodBankMatch = await Match.findOne(matchQuery)
        .sort({ rank: 1, _id: 1 })
        .session(session);
      if (!bloodBankMatch) {
        throw new DeliveryWorkflowError('This request has no accepted blood bank match.', 409);
      }

      if (request.status === 'FULFILLED') {
        if (bloodBankMatch.status !== 'FULFILLED' || !request.fulfilledAt) {
          throw new DeliveryWorkflowError('The request has an inconsistent fulfillment status.', 409);
        }
        result = {
          requestId: request.requestId,
          status: 'FULFILLED',
          fulfilledAt: request.fulfilledAt,
          alreadyReceived: true,
        };
        return;
      }

      const eligibleStatuses = [
        'RESOURCES_NOTIFIED',
        'RESPONSES_RECEIVED',
        'RESOURCE_SELECTED',
        'RESERVED',
        'PROCESSING',
        'IN_TRANSIT',
        'ESCALATED',
      ];
      if (!eligibleStatuses.includes(request.status)) {
        throw new DeliveryWorkflowError(`A ${request.status.toLowerCase()} request cannot be marked as received.`, 409);
      }

      const bloodBank = await BloodBank.findById(bloodBankMatch.resourceId)
        .select('name userId')
        .session(session);
      if (!bloodBank || bloodBank.userId.toString() !== bloodBankMatch.resourceUserId.toString()) {
        throw new DeliveryWorkflowError('The matched blood bank could not be found.', 409);
      }

      const activeReservation = await Reservation.findOne({
        emergencyRequestId: request._id,
        matchId: bloodBankMatch._id,
        status: 'ACTIVE',
      }).session(session);
      if (!activeReservation) {
        throw new DeliveryWorkflowError('The accepted blood bank reservation is no longer active.', 409);
      }

      const fulfilledAt = new Date();
      const updatedRequest = await EmergencyRequest.findOneAndUpdate(
        { _id: request._id, hospitalId: hospital._id, status: request.status },
        { $set: { status: 'FULFILLED', fulfilledAt } },
        { new: true, session }
      );
      if (!updatedRequest) {
        throw new DeliveryWorkflowError('The request status changed; refresh and try again.', 409);
      }

      await fulfillRequestReservations(
        request._id.toString(),
        { userId: hospitalUserId, userName: hospital.name },
        session
      );

      await createNotification({
        userId: bloodBankMatch.resourceUserId.toString(),
        type: 'FULFILLMENT_UPDATE',
        title: 'Blood delivery received',
        message: `${hospital.name} confirmed receipt of ${request.quantity} units of ${request.bloodGroup} ${request.component} for request ${request.requestId}.`,
        severity: request.severity,
        referenceType: 'EMERGENCY_RECEIPT',
        referenceId: request._id.toString(),
      }, session);

      result = {
        requestId: request.requestId,
        status: 'FULFILLED',
        fulfilledAt,
        alreadyReceived: false,
      };
    });
  } finally {
    await session.endSession();
  }

  if (!result) throw new Error('Receipt confirmation transaction completed without a result.');
  return result;
}