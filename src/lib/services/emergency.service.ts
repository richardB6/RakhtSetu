import { connectToDatabase } from '@/lib/db/mongodb';
import { EmergencyRequest } from '@/models/EmergencyRequest';
import { Hospital } from '@/models/Hospital';
import { generateRequestId } from '@/lib/utils/id-generator';
import { createAuditLog } from './audit.service';
import { isValidTransition, ACTIVE_STATUSES, RequestStatus, SeverityLevel, SEVERITY_CONFIG } from '@/lib/engine/compatibility';
import { DashboardStats } from '@/types';
import mongoose from 'mongoose';
import { fulfillRequestReservations, releaseRequestReservations } from '@/lib/services/reservation.service';

export async function createEmergencyRequest(data: any, hospitalId: string, userId: string) {
  await connectToDatabase();

  const hospital = await Hospital.findById(hospitalId);
  if (!hospital) {
    throw new Error('Hospital not found');
  }

  const requestId = generateRequestId();

  const requestData = {
    ...data,
    requestId,
    hospitalId: hospital._id,
    createdBy: userId,
    location: hospital.location,
    address: hospital.address,
    city: hospital.city,
    status: 'CREATED',
    quantityFulfilled: 0,
    matchCount: 0,
    responseCount: 0,
    responseTimeoutMinutes: Number.isFinite(Number(data.responseTimeoutMinutes))
      ? Math.max(1, Number(data.responseTimeoutMinutes))
      : (SEVERITY_CONFIG[data.severity as SeverityLevel]?.maxResponseTimeMinutes || 15),
    escalationLevel: 0,
  };

  const emergencyRequest = await EmergencyRequest.create(requestData);

  await Hospital.findByIdAndUpdate(hospitalId, {
    $inc: { emergencyRequestCount: 1 }
  });

  await createAuditLog({
    userId,
    userRole: 'HOSPITAL',
    userName: hospital.name, // Usually should get from user, but this is a fallback
    action: 'CREATE_EMERGENCY_REQUEST',
    entityType: 'EmergencyRequest',
    entityId: emergencyRequest._id.toString(),
    description: `Emergency request ${requestId} created`,
    newState: emergencyRequest.toObject()
  });

  return emergencyRequest;
}

export async function getEmergencyRequests(filters: {
  status?: RequestStatus | RequestStatus[];
  severity?: SeverityLevel;
  hospitalId?: string;
  bloodGroup?: string;
  component?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  await connectToDatabase();

  const query: any = {};

  if (filters.status) {
    query.status = Array.isArray(filters.status) ? { $in: filters.status } : filters.status;
  }
  if (filters.severity) query.severity = filters.severity;
  if (filters.hospitalId) query.hospitalId = filters.hospitalId;
  if (filters.bloodGroup) query.bloodGroup = filters.bloodGroup;
  if (filters.component) query.component = filters.component;
  if (filters.search) {
    query.$or = [
      { requestId: { $regex: filters.search, $options: 'i' } },
      { patientReference: { $regex: filters.search, $options: 'i' } },
    ];
  }

  const page = filters.page || 1;
  const limit = filters.limit || 10;
  const skip = (page - 1) * limit;

  // Custom sort to put CRITICAL first
  const requests = await EmergencyRequest.aggregate([
    { $match: query },
    {
      $addFields: {
        severityWeight: {
          $switch: {
            branches: [
              { case: { $eq: ['$severity', 'CRITICAL'] }, then: 3 },
              { case: { $eq: ['$severity', 'HIGH'] }, then: 2 },
              { case: { $eq: ['$severity', 'NORMAL'] }, then: 1 }
            ],
            default: 0
          }
        }
      }
    },
    { $sort: { severityWeight: -1, createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: 'hospitals',
        localField: 'hospitalId',
        foreignField: '_id',
        as: 'hospital'
      }
    },
    { $unwind: { path: '$hospital', preserveNullAndEmptyArrays: true } }
  ]);

  const total = await EmergencyRequest.countDocuments(query);

  return {
    data: requests,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

export async function getEmergencyById(id: string) {
  await connectToDatabase();

  const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { requestId: id };
  const request = await EmergencyRequest.findOne(query).populate('hospital');
  
  if (!request) {
    throw new Error('Emergency request not found');
  }

  return request;
}

export async function updateEmergencyStatus(id: string, newStatus: RequestStatus, userId: string, reason?: string) {
  await connectToDatabase();

  const request = await EmergencyRequest.findById(id);
  if (!request) {
    throw new Error('Emergency request not found');
  }

  if (!isValidTransition(request.status as RequestStatus, newStatus)) {
    throw new Error(`Invalid status transition from ${request.status} to ${newStatus}`);
  }

  const previousState = request.toObject();
  request.status = newStatus;

  if (newStatus === 'FULFILLED') {
    request.fulfilledAt = new Date();
  } else if (newStatus === 'CANCELLED') {
    request.cancelledAt = new Date();
    if (reason) request.cancellationReason = reason;
  } else if (newStatus === 'MATCHING' && !request.matchingStartedAt) {
    request.matchingStartedAt = new Date();
  }

  await request.save();

  if (newStatus === 'CANCELLED' || newStatus === 'EXPIRED') {
    await releaseRequestReservations(request._id.toString(), reason || newStatus, { userId, userName: userId });
  } else if (newStatus === 'FULFILLED') {
    await fulfillRequestReservations(request._id.toString(), { userId, userName: userId });
  }

  await createAuditLog({
    userId,
    userRole: 'HOSPITAL',
    userName: userId,
    action: newStatus === 'CANCELLED' ? 'CANCEL_EMERGENCY_REQUEST' : 'UPDATE_EMERGENCY_STATUS',
    entityType: 'EmergencyRequest',
    entityId: request._id.toString(),
    description: `Emergency request status updated to ${newStatus}`,
    previousState,
    newState: request.toObject()
  });

  return request;
}

export async function getDashboardStats(): Promise<Partial<DashboardStats>> {
  await connectToDatabase();

  const activeEmergencies = await EmergencyRequest.countDocuments({ status: { $in: ACTIVE_STATUSES } });
  const criticalRequests = await EmergencyRequest.countDocuments({ status: { $in: ACTIVE_STATUSES }, severity: 'CRITICAL' });
  const matchingInProgress = await EmergencyRequest.countDocuments({ status: 'MATCHING' });
  
  const totalFulfilled = await EmergencyRequest.countDocuments({ status: 'FULFILLED' });
  const totalNonDraft = await EmergencyRequest.countDocuments({ status: { $ne: 'DRAFT' } });
  
  const fulfillmentRate = totalNonDraft > 0 ? (totalFulfilled / totalNonDraft) * 100 : 0;

  const fulfilledRequests = await EmergencyRequest.find({
    status: 'FULFILLED',
    firstResponseAt: { $exists: true }
  });

  let totalResponseTime = 0;
  let countWithResponseTime = 0;

  for (const req of fulfilledRequests) {
    if (req.firstResponseAt && req.createdAt) {
      const diffMs = req.firstResponseAt.getTime() - req.createdAt.getTime();
      totalResponseTime += (diffMs / (1000 * 60)); // in minutes
      countWithResponseTime++;
    }
  }

  const avgResponseTimeMinutes = countWithResponseTime > 0 ? totalResponseTime / countWithResponseTime : 0;

  return {
    activeEmergencies,
    criticalRequests,
    matchingInProgress,
    fulfillmentRate,
    avgResponseTimeMinutes,
    totalFulfilled
  };
}
