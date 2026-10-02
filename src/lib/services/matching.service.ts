import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db/mongodb';
import { EmergencyRequest } from '@/models/EmergencyRequest';
import { Match } from '@/models/Match';
import { BloodBank } from '@/models/BloodBank';
import { Donor } from '@/models/Donor';
import { User } from '@/models/User';
import { ACTIVE_STATUSES, getCompatibleDonorGroups, getCompatibilityLevel, ComponentType, BloodGroup } from '@/lib/engine/compatibility';
import { rankResources } from '@/lib/engine/matching-policy';
import { createMatchNotification, createNotification } from '@/lib/services/notification.service';
import {
  InsufficientStockError,
  notifyReservationCreated,
  reserveAcceptedMatch,
} from '@/lib/services/reservation.service';
import { Reservation } from '@/models/Reservation';
import { findAllocatableInventory, getAllocatableInventoryUnits } from '@/lib/services/inventory.service';
export { rankResources } from '@/lib/engine/matching-policy';

const getAuditLogModel = () => mongoose.models.AuditLog || mongoose.model('AuditLog', new mongoose.Schema({}, { strict: false }));

function isRequestActiveAndUnexpired(request: InstanceType<typeof EmergencyRequest>, now = new Date()) {
  return ACTIVE_STATUSES.includes(request.status) && request.requiredBy > now;
}

function isRequestOpenForResponses(request: InstanceType<typeof EmergencyRequest>, now = new Date()) {
  return isRequestActiveAndUnexpired(request, now) &&
    (!request.responseDeadline || request.responseDeadline > now);
}

export interface CalculateMatchScoreParams {
  recipientBloodGroup: BloodGroup;
  donorBloodGroup: BloodGroup;
  component: ComponentType;
  distanceKm: number;
  availableQuantity: number;
  requestedQuantity: number;
  isVerified: boolean;
  responseRate: number;
  severity: 'CRITICAL' | 'HIGH' | 'NORMAL';
  requiredBy: Date;
  /** The clock used for scoring. Supplying it makes ranking reproducible. */
  asOf?: Date;
}

export function calculateMatchScore(params: CalculateMatchScoreParams) {
  const {
    recipientBloodGroup,
    donorBloodGroup,
    component,
    distanceKm,
    availableQuantity,
    requestedQuantity,
    isVerified,
    responseRate,
    severity,
    requiredBy,
  } = params;

  let compatibilityScore = 0;
  const compLevel = getCompatibilityLevel(recipientBloodGroup, donorBloodGroup, component);
  if (compLevel === 'EXACT') compatibilityScore = 100;
  else if (compLevel === 'COMPATIBLE') compatibilityScore = 75;
  else if (compLevel === 'EMERGENCY_UNIVERSAL') compatibilityScore = 50;

  let availabilityScore = 0;
  if (availableQuantity >= requestedQuantity) availabilityScore = 100;
  else if (availableQuantity >= requestedQuantity * 0.5) availabilityScore = 70;
  else if (availableQuantity >= 1) availabilityScore = 40;

  let distanceScore = 10;
  if (distanceKm <= 2) distanceScore = 100;
  else if (distanceKm <= 5) distanceScore = 85;
  else if (distanceKm <= 10) distanceScore = 70;
  else if (distanceKm <= 25) distanceScore = 50;
  else if (distanceKm <= 50) distanceScore = 30;

  let urgencyScore = 0;
  const hoursUntilRequired = (requiredBy.getTime() - (params.asOf || new Date()).getTime()) / (1000 * 60 * 60);
  if (severity === 'CRITICAL' && hoursUntilRequired <= 2) urgencyScore = 100;
  else if (severity === 'CRITICAL') urgencyScore = 80;
  else if (severity === 'HIGH' && hoursUntilRequired <= 12) urgencyScore = 70;
  else if (severity === 'HIGH') urgencyScore = 50;
  else urgencyScore = 30; // NORMAL

  let verificationScore = 0;
  if (isVerified) verificationScore = 100;
  else verificationScore = 40; // Assuming PENDING. If suspended, it shouldn't reach here usually.

  let responseReliabilityScore = 20;
  if (responseRate > 0.8) responseReliabilityScore = 100;
  else if (responseRate > 0.5) responseReliabilityScore = 70;
  else if (responseRate > 0.2) responseReliabilityScore = 40;
  else if (responseRate === -1) responseReliabilityScore = 60; // No history indicator

  const weights = {
    compatibility: 0.25,
    availability: 0.25,
    distance: 0.20,
    urgency: 0.10,
    verification: 0.10,
    responseReliability: 0.10,
  };

  const finalScore = Math.round(
    compatibilityScore * weights.compatibility +
    availabilityScore * weights.availability +
    distanceScore * weights.distance +
    urgencyScore * weights.urgency +
    verificationScore * weights.verification +
    responseReliabilityScore * weights.responseReliability
  );

  const reasons: string[] = [];
  if (compLevel === 'EXACT') reasons.push('Exact blood group match');
  else if (compLevel === 'COMPATIBLE') reasons.push('Compatible blood group');
  
  if (availableQuantity >= requestedQuantity) reasons.push('Required quantity fully available');
  else if (availableQuantity > 0) reasons.push('Partial quantity available');
  
  if (distanceKm <= 5) reasons.push(`Within ${distanceKm.toFixed(1)} km emergency radius`);
  else reasons.push(`${distanceKm.toFixed(1)} km from hospital`);
  if (isVerified) reasons.push('Verified resource');
  else reasons.push('Verification pending; hospital must confirm before release');
  if (responseRate > 0.8) reasons.push('High response reliability');
  else if (responseRate >= 0) reasons.push(`Response reliability ${(responseRate * 100).toFixed(0)}%`);

  return {
    score: finalScore,
    factors: {
      compatibilityScore,
      availabilityScore,
      distanceScore,
      verificationScore,
      responseReliabilityScore,
      urgencyScore,
    },
    reasons,
    compatibilityType: compLevel || 'COMPATIBLE'
  };
}

/** Operational scoring alias kept explicit to distinguish it from clinical decisions. */
export const calculateOperationalScore = calculateMatchScore;

async function deliverMatchNotifications(
  request: InstanceType<typeof EmergencyRequest>,
  matches: Array<{
    _id: mongoose.Types.ObjectId;
    status: string;
    resourceType: string;
    resourceId: mongoose.Types.ObjectId;
    resourceUserId: mongoose.Types.ObjectId;
    distanceKm: number;
  }>,
  donorsOnly = false
) {
  const now = new Date();
  if (!isRequestOpenForResponses(request, now)) return 0;

  const pendingMatches = matches.filter((match) => ['PENDING', 'NOTIFIED'].includes(match.status));
  const bankMatches = donorsOnly
    ? []
    : pendingMatches.filter((match) => match.resourceType === 'BLOOD_BANK').slice(0, 10);
  const compatibleGroups = getCompatibleDonorGroups(request.bloodGroup as BloodGroup, request.component as ComponentType);
  const donorMatches = pendingMatches.filter((match) => match.resourceType === 'DONOR');
  const eligibleDonorMatches = (await Promise.all(donorMatches.map(async (match) => {
    const [donor, user, activeReservation] = await Promise.all([
      Donor.findOne({
        _id: match.resourceId,
        userId: match.resourceUserId,
        bloodGroup: { $in: compatibleGroups },
        availabilityStatus: 'AVAILABLE',
        isAvailable: true,
        emergencyNotificationsEnabled: true,
      }).select('availabilityRadius').lean(),
      User.findOne({ _id: match.resourceUserId, isActive: true, verificationStatus: 'VERIFIED' }).select('_id').lean(),
      Reservation.exists({ donorId: match.resourceId, status: 'ACTIVE' }),
    ]);
    if (!donor || !user || activeReservation || match.distanceKm > request.searchRadiusKm || match.distanceKm > donor.availabilityRadius) return null;
    return match;
  }))).filter((match): match is InstanceType<typeof Match> => match !== null);
  const targets = [...bankMatches, ...eligibleDonorMatches];

  await Promise.all(targets.map((match) => createMatchNotification({
    userId: match.resourceUserId.toString(),
    title: 'Emergency Blood Request Match',
    message: `You have been matched for an emergency request of ${request.quantity} units of ${request.bloodGroup} ${request.component}. Respond before ${request.responseDeadline?.toISOString()}.`,
    severity: request.severity,
    referenceId: match._id.toString(),
  })));

  if (targets.length > 0) {
    await Match.updateMany(
      { _id: { $in: targets.map((match) => match._id) }, status: { $in: ['PENDING', 'NOTIFIED'] } },
      { $set: { status: 'NOTIFIED', notifiedAt: now } }
    );
  }
  return eligibleDonorMatches.length;
}

export async function runMatchingEngine(emergencyRequestId: string, userId: string, isAdmin = false) {
  await connectToDatabase();
  
  const request = await EmergencyRequest.findOne(
    mongoose.Types.ObjectId.isValid(emergencyRequestId)
      ? { _id: emergencyRequestId }
      : { requestId: emergencyRequestId }
  );
  if (!request) {
    throw new Error('Emergency request not found');
  }
  if (!isAdmin && request.createdBy.toString() !== userId) {
    throw new Error('You do not have access to this request');
  }

  // Do not start a search for malformed or already terminal requests. This is
  // intentionally explicit rather than relying on Mongoose's enum validation.
  if (!request.bloodGroup || !request.component || request.quantity < 1 ||
      !Number.isFinite(request.searchRadiusKm) || request.searchRadiusKm <= 0 ||
      !request.location?.coordinates || request.location.coordinates.length !== 2 ||
      request.location.coordinates.some((coordinate) => !Number.isFinite(coordinate)) ||
      !(request.requiredBy instanceof Date) || Number.isNaN(request.requiredBy.getTime())) {
    throw new Error('Emergency request is not valid for matching');
  }
  if (['FULFILLED', 'CANCELLED', 'EXPIRED'].includes(request.status)) {
    throw new Error(`Cannot match a ${request.status.toLowerCase()} request`);
  }
  if (request.requiredBy <= new Date()) {
    throw new Error('Cannot match an expired emergency request');
  }
  if (!['CREATED', 'MATCHING', 'ESCALATED'].includes(request.status)) {
    const existing = await Match.find({ emergencyRequestId: request._id }).sort({ rank: 1, _id: 1 });
    if (existing.length > 0) {
      await deliverMatchNotifications(request, existing);
      return existing;
    }
    throw new Error(`Request is already ${request.status.toLowerCase()}`);
  }

  // A retry replaces stale pending matches instead of creating duplicate
  // notifications and ranks.
  await Match.deleteMany({ emergencyRequestId: request._id, status: { $in: ['PENDING', 'NOTIFIED'] } });
  request.status = 'MATCHING';
  request.matchingMessage = undefined;
  request.matchingStartedAt = new Date();
  await request.save();

  const compatibleGroups = getCompatibleDonorGroups(request.bloodGroup as BloodGroup, request.component as ComponentType);
  if (compatibleGroups.length === 0) {
    throw new Error('No compatible blood groups found for this component');
  }

  const allMatches = [];
  const requestPoint = {
    type: 'Point' as const,
    coordinates: request.location.coordinates as [number, number],
  };

  const outstandingQuantity = Math.max(1, request.quantity - request.quantityFulfilled);
  const bloodBankMatches = new Map<string, any>();

  // Query Blood Banks
  const bloodBanks = await BloodBank.aggregate([
    {
      $geoNear: {
        key: 'location',
        near: requestPoint,
        distanceField: 'distance',
        maxDistance: request.searchRadiusKm * 1000,
        spherical: true,
      },
    },
    {
      $match: {
        isOpen: true,
        operationalStatus: { $nin: ['UNAVAILABLE', 'CLOSED'] },
        componentCapabilities: request.component,
      },
    },
  ]);

  for (const bb of bloodBanks) {
    const bbDistanceKm = bb.distance / 1000;
    
    // Check inventory
    const inventoryItem = await findAllocatableInventory(
      bb._id.toString(),
      request.bloodGroup as BloodGroup,
      request.component as ComponentType
    );
    const availableQuantity = getAllocatableInventoryUnits(inventoryItem);
    if (availableQuantity < outstandingQuantity) continue;

    const user = await User.findOne({
      _id: bb.userId,
      isActive: true,
      verificationStatus: 'VERIFIED',
    }).lean();
    if (!user) continue;

    const responseRate = bb.totalResponseCount > 0 ? bb.acceptedResponseCount / bb.totalResponseCount : -1;
    const matchResult = calculateMatchScore({
      recipientBloodGroup: request.bloodGroup as BloodGroup,
      donorBloodGroup: request.bloodGroup as BloodGroup,
      component: request.component as ComponentType,
      distanceKm: bbDistanceKm,
      availableQuantity,
      requestedQuantity: outstandingQuantity,
      isVerified: user.verificationStatus === 'VERIFIED',
      responseRate,
      severity: request.severity,
      requiredBy: request.requiredBy,
      asOf: request.matchingStartedAt,
    });

    bloodBankMatches.set(bb._id.toString(), {
      emergencyRequestId: request._id,
      resourceType: 'BLOOD_BANK',
      resourceId: bb._id,
      resourceUserId: bb.userId,
      score: matchResult.score,
      factors: matchResult.factors,
      compatibilityType: matchResult.compatibilityType,
      distanceKm: bbDistanceKm,
      availableQuantity,
      isVerified: user.verificationStatus === 'VERIFIED',
      reasons: matchResult.reasons,
      status: 'PENDING',
    });
  }
  allMatches.push(...bloodBankMatches.values());

  // Query Donors
  const donorIndexes = await Donor.collection.indexes();
  if (!donorIndexes.some((index) => index.key.location === '2dsphere')) {
    await Donor.collection.createIndex({ location: '2dsphere' });
  }
  const donors = await Donor.aggregate([
    {
      $geoNear: {
        key: 'location',
        near: requestPoint,
        distanceField: 'distance',
        maxDistance: request.searchRadiusKm * 1000,
        spherical: true,
      },
    },
    {
      $lookup: {
        from: 'reservations',
        let: { donorId: '$_id' },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ['$donorId', '$$donorId'] }, { $eq: ['$status', 'ACTIVE'] }] } } },
          { $limit: 1 },
        ],
        as: 'activeReservations',
      },
    },
    { $match: { 'activeReservations.0': { $exists: false } } },
    {
      $match: {
        bloodGroup: { $in: compatibleGroups },
        availabilityStatus: 'AVAILABLE',
        isAvailable: true,
        emergencyNotificationsEnabled: true,
        $expr: { $lte: ['$distance', { $multiply: ['$availabilityRadius', 1000] }] },
      },
    },
  ]);

  for (const donor of donors) {
    const donorDistanceKm = donor.distance / 1000;
    const user = await User.findOne({
      _id: donor.userId,
      isActive: true,
      verificationStatus: 'VERIFIED',
    }).lean();
    if (!user) continue;

    const responseRate = donor.totalResponseCount > 0 ? donor.acceptedResponseCount / donor.totalResponseCount : -1;
    
    // Donors typically represent 1 unit per donation
    const matchResult = calculateMatchScore({
      recipientBloodGroup: request.bloodGroup as BloodGroup,
      donorBloodGroup: donor.bloodGroup as BloodGroup,
      component: request.component as ComponentType,
      distanceKm: donorDistanceKm,
      availableQuantity: 1, // Assume 1 unit available per donor
      requestedQuantity: request.quantity,
      isVerified: user.verificationStatus === 'VERIFIED',
      responseRate,
      severity: request.severity,
      requiredBy: request.requiredBy,
      asOf: request.matchingStartedAt,
    });

    allMatches.push({
      emergencyRequestId: request._id,
      resourceType: 'DONOR',
      resourceId: donor._id,
      resourceUserId: donor.userId,
      score: matchResult.score,
      factors: matchResult.factors,
      compatibilityType: matchResult.compatibilityType,
      distanceKm: donorDistanceKm,
      availableQuantity: 1,
      isVerified: user.verificationStatus === 'VERIFIED',
      reasons: matchResult.reasons,
      status: 'PENDING',
    });
  }

  // Sort and assign ranks
  // Every tie-breaker is stable and based on persisted values. This prevents
  // MongoDB iteration order from changing who is notified first.
  const rankedMatches = rankResources(allMatches).map((m, idx) => ({ ...m, rank: idx + 1 }));

  // Save matches to DB
  const insertedMatches = await Match.insertMany(rankedMatches);
  const createdMatches = await Match.find({ _id: { $in: insertedMatches.map((match) => match._id) } });

  // Update request
  request.status = createdMatches.length > 0 ? 'RESOURCES_NOTIFIED' : 'ESCALATED';
  request.matchingMessage = createdMatches.length > 0
    ? undefined
    : `No eligible resource with sufficient compatible stock was found within ${request.searchRadiusKm} km. The emergency request remains open; expand the search radius or try again when stock changes.`;
  request.responseDeadline = createdMatches.length > 0
    ? new Date(Date.now() + request.responseTimeoutMinutes * 60 * 1000)
    : undefined;
  request.matchCount = createdMatches.length;
  await request.save();

  await deliverMatchNotifications(request, createdMatches);

  // Create audit log
  const AuditLogModel = getAuditLogModel();
  await AuditLogModel.create({
    userId,
    userRole: 'SYSTEM',
    userName: 'Matching Engine',
    action: 'RUN_MATCHING',
    entityType: 'EMERGENCY_REQUEST',
    entityId: request._id,
    description: `Ran matching engine for request ${request.requestId}, found ${createdMatches.length} matches.`,
    createdAt: new Date(),
  });

  return createdMatches;
}

export async function backfillEligibleDonorMatchNotifications(
  limit = 500,
  requestIds?: string[],
  donorUserId?: string
) {
  await connectToDatabase();
  const now = new Date();
  let scopedRequestIds: mongoose.Types.ObjectId[] | undefined;
  if (donorUserId) {
    const matchQuery: Record<string, unknown> = {
      resourceType: 'DONOR',
      resourceUserId: donorUserId,
      status: { $in: ['PENDING', 'NOTIFIED'] },
    };
    if (requestIds) matchQuery.emergencyRequestId = { $in: requestIds };
    scopedRequestIds = await Match.distinct('emergencyRequestId', matchQuery);
    if (scopedRequestIds.length === 0) return { requestsChecked: 0, donorMatchesNotified: 0 };
  }
  const requests = await EmergencyRequest.find({
    ...(scopedRequestIds ? { _id: { $in: scopedRequestIds } } : requestIds ? { _id: { $in: requestIds } } : {}),
    status: { $in: ACTIVE_STATUSES },
    requiredBy: { $gt: now },
    $or: [
      { responseDeadline: { $gt: now } },
      { responseDeadline: { $exists: false } },
    ],
  })
    .sort({ createdAt: 1 })
    .limit(Math.min(Math.max(Math.floor(limit), 1), 5000));

  let donorMatchesNotified = 0;
  for (const request of requests) {
    const donorMatches = await Match.find({
      emergencyRequestId: request._id,
      resourceType: 'DONOR',
      status: { $in: ['PENDING', 'NOTIFIED'] },
      ...(donorUserId ? { resourceUserId: donorUserId } : {}),
    });
    donorMatchesNotified += await deliverMatchNotifications(request, donorMatches, true);
  }

  return { requestsChecked: requests.length, donorMatchesNotified };
}

export async function getMatchesForRequest(emergencyRequestId: string, userId?: string, role?: string) {
  await connectToDatabase();
  const request = await EmergencyRequest.findOne(
    mongoose.Types.ObjectId.isValid(emergencyRequestId)
      ? { _id: emergencyRequestId }
      : { requestId: emergencyRequestId }
  ).select('_id');
  if (!request) throw new Error('Emergency request not found');

  const matchQuery: Record<string, unknown> = { emergencyRequestId: request._id };
  if (role === 'BLOOD_BANK' && userId) matchQuery.resourceUserId = userId;
  const matches = await Match.find(matchQuery)
    .sort({ rank: 1, _id: 1 })
    .select('_id emergencyRequestId resourceType resourceId resourceUserId status rank score reasons compatibilityType notifiedAt respondedAt createdAt updatedAt')
    .populate('resourceUserId', '_id name role verificationStatus');

  // resourceId is intentionally polymorphic in Match, so Mongoose cannot
  // populate it from the schema. Hydrate the resource for the UI explicitly.
  return Promise.all(matches.map(async (match) => {
    const resource = match.resourceType === 'BLOOD_BANK'
      ? await BloodBank.findById(match.resourceId).select('name city state location operationalStatus isOpen componentCapabilities').lean()
      : await Donor.findById(match.resourceId).select('city state location isAvailable availabilityStatus bloodGroup').lean();
    const value = match.toObject();
    return {
      ...value,
      resourceUser: value.resourceUserId,
      [match.resourceType === 'BLOOD_BANK' ? 'bloodBank' : 'donor']: resource,
    };
  }));
}

export async function recoverStaleMatchingRequests(limit = 5) {
  await connectToDatabase();

  const staleBefore = new Date(Date.now() - 60_000);
  const staleRequestFilter = {
    status: 'MATCHING' as const,
    matchCount: { $in: [0, null] },
    $or: [
      { matchingStartedAt: { $lt: staleBefore } },
      { matchingStartedAt: { $exists: false }, createdAt: { $lt: staleBefore } },
    ],
  };
  const staleRequests = await EmergencyRequest.find(staleRequestFilter)
    .select('_id createdBy')
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean();

  for (const staleRequest of staleRequests) {
    const claimedAt = new Date();
    const claimedRequest = await EmergencyRequest.findOneAndUpdate(
      { ...staleRequestFilter, _id: staleRequest._id },
      { $set: { matchingStartedAt: claimedAt, matchingMessage: undefined } },
      { returnDocument: 'after' }
    );
    if (!claimedRequest) continue;

    try {
      await runMatchingEngine(claimedRequest._id.toString(), claimedRequest.createdBy.toString());
    } catch (error) {
      console.error('[Matching recovery] Failed to resume stale request:', error);
      await EmergencyRequest.updateOne(
        { _id: claimedRequest._id, status: 'MATCHING', matchingStartedAt: claimedAt },
        {
          $set: {
            status: 'ESCALATED',
            matchingMessage: 'Matching could not complete. Confirm resource availability or contact an administrator.',
          },
        }
      );
    }
  }
}

export async function escalateMatchIfInsufficientStock(matchId: string, userId: string) {
  await connectToDatabase();
  const match = await Match.findOne({
    _id: matchId,
    resourceType: 'BLOOD_BANK',
    resourceUserId: userId,
    status: { $in: ['PENDING', 'NOTIFIED'] },
  });
  if (!match) return null;

  const request = await EmergencyRequest.findById(match.emergencyRequestId);
  if (!request) throw new Error('Associated emergency request not found');
  if (!isRequestActiveAndUnexpired(request)) return null;

  const bloodBank = await BloodBank.findOne({
    _id: match.resourceId,
    userId: match.resourceUserId,
    isOpen: true,
    operationalStatus: { $nin: ['UNAVAILABLE', 'CLOSED'] },
    componentCapabilities: request.component,
  }).select('_id');
  const inventory = bloodBank
    ? await findAllocatableInventory(
      bloodBank._id.toString(),
      request.bloodGroup as BloodGroup,
      request.component as ComponentType
    )
    : null;
  const availableQuantity = getAllocatableInventoryUnits(inventory);
  const requiredQuantity = Math.max(1, request.quantity - request.quantityFulfilled);
  if (bloodBank && availableQuantity >= requiredQuantity) return null;

  const declinedMatch = await Match.findOneAndUpdate(
    {
      _id: match._id,
      resourceUserId: userId,
      status: { $in: ['PENDING', 'NOTIFIED'] },
    },
    {
      $set: {
        status: 'DECLINED',
        respondedAt: new Date(),
        declineReason: `Cannot accept — insufficient stock (${availableQuantity} of ${requiredQuantity} ${request.bloodGroup} ${request.component} units available)`,
      },
    },
    { new: true }
  );
  if (!declinedMatch) return null;
  await escalateAfterDecline(declinedMatch, request, userId);
  return declinedMatch;
}

export async function respondToMatch(matchId: string, userId: string, accept: boolean, declineReason?: string) {
  await connectToDatabase();
  
  const match = await Match.findById(matchId).populate('emergencyRequestId');
  if (!match) {
    throw new Error('Match not found');
  }

  if (match.status !== 'PENDING' && match.status !== 'NOTIFIED') {
    throw new Error('Match already responded to');
  }

  // Verify the user responding is the resource user
  if (match.resourceUserId.toString() !== userId.toString()) {
    throw new Error('Unauthorized to respond to this match');
  }

  const request = await EmergencyRequest.findById(match.emergencyRequestId);
  if (!request) {
    throw new Error('Associated emergency request not found');
  }
  if (!isRequestOpenForResponses(request)) {
    throw new Error('Emergency request is no longer active or has expired');
  }

  const AuditLogModel = getAuditLogModel();

  if (accept) {
    if (match.resourceType === 'BLOOD_BANK') {
      const session = await mongoose.startSession();
      let reservation: InstanceType<typeof Reservation> | undefined;
      try {
        await session.withTransaction(async () => {
          const claimedMatch = await Match.findOneAndUpdate(
            {
              _id: match._id,
              resourceUserId: userId,
              status: { $in: ['PENDING', 'NOTIFIED'] },
            },
            { $set: { status: 'ACCEPTED', respondedAt: new Date() } },
            { new: true, session }
          );
          if (!claimedMatch) throw new Error('Match already responded to');

          const currentRequest = await EmergencyRequest.findById(request._id).session(session);
          if (!currentRequest) throw new Error('Associated emergency request not found');

          reservation = await reserveAcceptedMatch(
            claimedMatch._id.toString(),
            { userId, userName: 'Resource User' },
            session
          );
          currentRequest.responseCount += 1;
          if (currentRequest.responseCount === 1) currentRequest.firstResponseAt = new Date();
          if (currentRequest.status === 'RESOURCES_NOTIFIED' || currentRequest.status === 'ESCALATED') {
            currentRequest.status = 'RESPONSES_RECEIVED';
          }
          await currentRequest.save({ session });
          match.status = 'RESERVED';
          match.respondedAt = claimedMatch.respondedAt;
        });
      } catch (error) {
        if (error instanceof InsufficientStockError) {
          const declinedMatch = await Match.findOneAndUpdate(
            {
              _id: match._id,
              resourceUserId: userId,
              status: { $in: ['PENDING', 'NOTIFIED'] },
            },
            {
              $set: {
                status: 'DECLINED',
                respondedAt: new Date(),
                declineReason: error.message,
              },
            },
            { new: true }
          );
          if (declinedMatch) {
            const currentRequest = await EmergencyRequest.findById(request._id);
            if (currentRequest) await escalateAfterDecline(declinedMatch, currentRequest, userId);
          }
        }
        throw error;
      } finally {
        await session.endSession();
      }
      if (!reservation) throw new Error('Reservation transaction did not complete');
      await notifyReservationCreated(reservation, { userId, userName: 'Resource User' });
    } else {
      match.status = 'ACCEPTED';
      match.respondedAt = new Date();
      await match.save();
      await reserveAcceptedMatch(match._id.toString(), { userId, userName: 'Resource User' });

      request.responseCount += 1;
      if (request.responseCount === 1) request.firstResponseAt = new Date();
      if (request.status === 'RESOURCES_NOTIFIED' || request.status === 'ESCALATED') {
        request.status = 'RESPONSES_RECEIVED';
      }
      await request.save();
    }

    await AuditLogModel.create({
      userId,
      userRole: 'RESOURCE',
      userName: 'Resource User',
      action: 'ACCEPT_MATCH',
      entityType: 'MATCH',
      entityId: match._id,
      description: `User accepted match ${match._id} for emergency request ${request.requestId}.`,
      createdAt: new Date(),
    });
    
  } else {
    // DECLINE path — mark current match as declined
    match.status = 'DECLINED';
    match.respondedAt = new Date();
    match.declineReason = declineReason;
    await match.save();

    await AuditLogModel.create({
      userId,
      userRole: 'RESOURCE',
      userName: 'Resource User',
      action: 'DECLINE_MATCH',
      entityType: 'MATCH',
      entityId: match._id,
      description: `User declined match ${match._id} for emergency request ${request.requestId}. Reason: ${declineReason || 'None'}`,
      createdAt: new Date(),
    });

    // Escalation: find the next eligible resource, skipping already-declined/cancelled ones
    await escalateAfterDecline(match, request, userId);
  }

  return match;
}

/**
 * After a decline, find the next highest-ranked un-notified match for the same emergency request.
 * If a next match exists, notify it. If none remain, set request to ESCALATED and notify hospital.
 */
async function escalateAfterDecline(
  declinedMatch: InstanceType<typeof Match>,
  request: InstanceType<typeof EmergencyRequest>,
  systemUserId: string
) {
  if (!isRequestActiveAndUnexpired(request)) return;
  const AuditLogModel = getAuditLogModel();

  while (true) {
    const nextMatch = await Match.findOne({
      emergencyRequestId: request._id,
      status: 'PENDING',
      _id: { $ne: declinedMatch._id },
    }).sort({ rank: 1, _id: 1 });
    if (!nextMatch) break;

    if (nextMatch.resourceType === 'BLOOD_BANK') {
      const bloodBank = await BloodBank.findOne({
        _id: nextMatch.resourceId,
        userId: nextMatch.resourceUserId,
        isOpen: true,
        operationalStatus: { $nin: ['UNAVAILABLE', 'CLOSED'] },
        componentCapabilities: request.component,
      }).lean();
      const user = bloodBank
        ? await User.findOne({
          _id: bloodBank.userId,
          isActive: true,
          verificationStatus: 'VERIFIED',
        }).select('_id').lean()
        : null;
      const inventory = bloodBank && user
        ? await findAllocatableInventory(
          bloodBank._id.toString(),
          request.bloodGroup as BloodGroup,
          request.component as ComponentType
        )
        : null;
      const availableQuantity = getAllocatableInventoryUnits(inventory);
      const requiredQuantity = Math.max(1, request.quantity - request.quantityFulfilled);
      if (!bloodBank || !user || availableQuantity < requiredQuantity) {
        await Match.updateOne(
          { _id: nextMatch._id, status: 'PENDING' },
          {
            $set: {
              status: 'DECLINED',
              respondedAt: new Date(),
              declineReason: !bloodBank || !user
                ? 'Blood bank is no longer eligible'
                : `Insufficient stock (${availableQuantity} of ${requiredQuantity} ${request.bloodGroup} ${request.component} units available)`,
            },
          }
        );
        continue;
      }
    }

    const promotedMatch = await Match.findOneAndUpdate(
      { _id: nextMatch._id, status: 'PENDING' },
      { $set: { status: 'NOTIFIED', notifiedAt: new Date() } },
      { new: true }
    );
    if (!promotedMatch) continue;

    await createMatchNotification({
      userId: promotedMatch.resourceUserId.toString(),
      title: 'Emergency Blood Request — Action Required',
      message: `An emergency request for ${request.quantity} units of ${request.bloodGroup} ${request.component} requires your response. Previous resource declined or lacked sufficient stock. Please respond urgently. Match ID: ${promotedMatch._id}`,
      severity: request.severity,
      referenceId: promotedMatch._id.toString(),
    });

    await AuditLogModel.create({
      userId: systemUserId,
      userRole: 'SYSTEM',
      userName: 'Escalation Engine',
      action: 'ESCALATE_TO_NEXT_RESOURCE',
      entityType: 'MATCH',
      entityId: promotedMatch._id,
      description: `Escalated emergency ${request.requestId} to next resource after decline or insufficient stock. New match: ${promotedMatch._id}`,
      createdAt: new Date(),
    });
    return;
  }

  const acceptedMatch = await Match.exists({
    emergencyRequestId: request._id,
    status: { $in: ['ACCEPTED', 'RESERVED'] },
  });
  if (acceptedMatch) return;

  const message = 'No suitable compatible stock is currently available. The emergency request remains open and escalated.';
  const escalatedRequest = await EmergencyRequest.findOneAndUpdate(
    { _id: request._id, matchingMessage: { $ne: message } },
    { $set: { status: 'ESCALATED', matchingMessage: message }, $inc: { escalationLevel: 1 } },
    { new: true }
  );
  if (!escalatedRequest) return;

  await createNotification({
    userId: request.createdBy.toString(),
    type: 'ESCALATION',
    title: 'No Suitable Blood Stock Available — Action Required',
    message: `No eligible resource currently has sufficient compatible stock for emergency request ${request.requestId} (${request.bloodGroup}, ${request.quantity} units). The request remains open for escalation.`,
    severity: 'CRITICAL',
    referenceType: 'EMERGENCY_REQUEST',
    referenceId: request._id.toString(),
  });

  await AuditLogModel.create({
    userId: systemUserId,
    userRole: 'SYSTEM',
    userName: 'Escalation Engine',
    action: 'NO_RESOURCES_AVAILABLE',
    entityType: 'EMERGENCY_REQUEST',
    entityId: request._id,
    description: `No suitable compatible stock is currently available for emergency ${request.requestId}. Request remains escalated.`,
    createdAt: new Date(),
  });
}
