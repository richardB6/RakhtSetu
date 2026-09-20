import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db/mongodb';
import { EmergencyRequest } from '@/models/EmergencyRequest';
import { Match } from '@/models/Match';
import { Escalation } from '@/models/Escalation';
import { User } from '@/models/User';
import { createNotification } from './notification.service';
import { createAuditLog } from './audit.service';
import { runMatchingEngine } from './matching.service';
import { updateEmergencyStatus } from './emergency.service';
import { RequestStatus } from '@/lib/engine/compatibility';
import { releaseMatchReservation } from './reservation.service';

async function getRequest(id: string) {
  const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { requestId: id };
  const request = await EmergencyRequest.findOne(query);
  if (!request) throw new Error('Emergency request not found');
  return request;
}

export async function selectAcceptedMatch(requestId: string, matchId: string, userId: string, isAdmin = false) {
  await connectToDatabase();
  let request = await getRequest(requestId);
  if (!isAdmin && request.createdBy.toString() !== userId) {
    throw new Error('You do not have access to this request');
  }
  if (!['RESPONSES_RECEIVED', 'RESOURCE_SELECTED'].includes(request.status)) {
    throw new Error(`Cannot select a resource while request is ${request.status}`);
  }
  const match = await Match.findOne({ _id: matchId, emergencyRequestId: request._id, status: 'ACCEPTED' });
  if (!match) throw new Error('Only an accepted match for this request can be selected');
  const claimedRequest = await EmergencyRequest.findOneAndUpdate(
    {
      _id: request._id,
      status: { $in: ['RESPONSES_RECEIVED', 'RESOURCE_SELECTED'] },
      selectedMatchId: { $exists: false },
    },
    { $set: { selectedMatchId: match._id, status: 'RESOURCE_SELECTED' } },
    { returnDocument: 'after' }
  );
  if (!claimedRequest) {
    throw new Error('Another resource has already been selected for this request');
  }
  request = claimedRequest;
  const cancelledMatches = await Match.find(
    { emergencyRequestId: request._id, _id: { $ne: match._id }, status: { $in: ['PENDING', 'NOTIFIED', 'ACCEPTED'] } }
  ).select('_id');
  await Match.updateMany(
    { _id: { $in: cancelledMatches.map((candidate) => candidate._id) } },
    { $set: { status: 'CANCELLED' } }
  );
  await Promise.all(cancelledMatches.map((candidate) => releaseMatchReservation(candidate._id.toString(), 'RESOURCE_NOT_SELECTED', { userId, userName: userId })));
  await updateEmergencyStatus(request._id.toString(), 'RESERVED', userId);
  match.status = 'RESERVED';
  await match.save();
  await createAuditLog({
    userId, userRole: 'HOSPITAL', userName: userId, action: 'SELECT_RESOURCE',
    entityType: 'EmergencyRequest', entityId: request._id.toString(),
    description: `Selected accepted match ${match._id.toString()} and reserved the resource.`,
    newState: { selectedMatchId: match._id.toString(), status: 'RESERVED' },
  });
  return { request: await EmergencyRequest.findById(request._id), match };
}

export async function advanceResponseWorkflow(requestId: string, status: RequestStatus, userId: string) {
  await connectToDatabase();
  const request = await getRequest(requestId);
  const result = await updateEmergencyStatus(request._id.toString(), status, userId);
  if (status === 'PROCESSING' || status === 'FULFILLED') {
    const match = request.selectedMatchId ? await Match.findById(request.selectedMatchId) : null;
    if (match) {
      match.status = status === 'FULFILLED' ? 'FULFILLED' : 'RESERVED';
      await match.save();
      await createNotification({
        userId: match.resourceUserId.toString(),
        type: 'FULFILLMENT_UPDATE',
        title: `Request ${status.toLowerCase()}`,
        message: `The hospital has moved request ${request.requestId} to ${status}.`,
        severity: request.severity,
        referenceType: 'EMERGENCY_REQUEST',
        referenceId: request._id.toString(),
      });
    }
  }
  return result;
}

export async function escalateTimedOutRequest(requestId: string, userId: string, force = false, isAdmin = false) {
  await connectToDatabase();
  const request = await getRequest(requestId);
  if (!isAdmin && request.createdBy.toString() !== userId) {
    throw new Error('You do not have access to this request');
  }
  if (!force && (!request.responseDeadline || request.responseDeadline > new Date())) {
    throw new Error('Response timeout has not elapsed');
  }
  if (!['RESOURCES_NOTIFIED', 'RESPONSES_RECEIVED', 'ESCALATED'].includes(request.status)) {
    throw new Error(`Cannot escalate a request in ${request.status}`);
  }
  const previousRadius = request.searchRadiusKm;
  const maxRadius = request.severity === 'CRITICAL' ? 100 : request.severity === 'HIGH' ? 75 : 50;
  const newRadius = Math.min(Math.max(previousRadius * 2, previousRadius + 5), maxRadius);
  const level = request.escalationLevel + 1;
  const type = newRadius > previousRadius ? 'RADIUS_EXPANSION' : 'COORDINATOR_ALERT';
  await Escalation.updateMany({ emergencyRequestId: request._id, status: 'ACTIVE' }, { $set: { status: 'SUPERSEDED' } });
  const escalation = await Escalation.create({
    emergencyRequestId: request._id, level, type,
    trigger: 'AUTO_TIMEOUT',
    triggerDetails: `No response before ${request.responseDeadline?.toISOString() || 'configured deadline'}.`,
    previousRadiusKm: previousRadius, newRadiusKm: newRadius, status: 'ACTIVE',
  });
  request.searchRadiusKm = newRadius;
  request.escalationLevel = level;
  request.status = 'ESCALATED';
  request.responseDeadline = new Date(Date.now() + (request.responseTimeoutMinutes * Math.pow(2, level)) * 60 * 1000);
  await request.save();
  const admins = await User.find({ role: 'ADMIN', isActive: true }).select('_id');
  await Promise.all(admins.map((admin) => createNotification({
    userId: admin._id.toString(), type: 'ESCALATION',
    title: 'Emergency request escalated',
    message: `${request.requestId} timed out; radius expanded to ${newRadius} km.`,
    severity: 'CRITICAL', referenceType: 'ESCALATION', referenceId: escalation._id.toString(),
  })));
  await createAuditLog({
    userId, userRole: 'SYSTEM', userName: 'Escalation Engine', action: 'ESCALATE_REQUEST',
    entityType: 'EmergencyRequest', entityId: request._id.toString(),
    description: `Escalated request to level ${level}; radius ${previousRadius} -> ${newRadius} km.`,
    newState: { status: request.status, escalationLevel: level, searchRadiusKm: newRadius },
  });
  const matches = newRadius > previousRadius
    ? await runMatchingEngine(request._id.toString(), userId, isAdmin)
    : [];
  return { escalation, request: await EmergencyRequest.findById(request._id), matches };
}
