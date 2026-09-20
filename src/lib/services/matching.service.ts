import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db/mongodb';
import { EmergencyRequest } from '@/models/EmergencyRequest';
import { Match } from '@/models/Match';
import { Inventory } from '@/models/Inventory';
import { BloodBank } from '@/models/BloodBank';
import { Donor } from '@/models/Donor';
import { User } from '@/models/User';
import { getCompatibleDonorGroups, getCompatibilityLevel, ComponentType, BloodGroup } from '@/lib/engine/compatibility';
import { rankResources } from '@/lib/engine/matching-policy';
import { createNotification } from '@/lib/services/notification.service';
import { reserveAcceptedMatch } from '@/lib/services/reservation.service';
export { rankResources } from '@/lib/engine/matching-policy';

// Dynamically access Notification and AuditLog models to avoid strict import errors if they don't exist yet
const getNotificationModel = () => mongoose.models.Notification || mongoose.model('Notification', new mongoose.Schema({}, { strict: false }));
const getAuditLogModel = () => mongoose.models.AuditLog || mongoose.model('AuditLog', new mongoose.Schema({}, { strict: false }));

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

export async function runMatchingEngine(emergencyRequestId: string, userId: string) {
  await connectToDatabase();
  
  const request = await EmergencyRequest.findOne(
    mongoose.Types.ObjectId.isValid(emergencyRequestId)
      ? { _id: emergencyRequestId }
      : { requestId: emergencyRequestId }
  );
  if (!request) {
    throw new Error('Emergency request not found');
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
  if (!['CREATED', 'MATCHING', 'ESCALATED'].includes(request.status)) {
    const existing = await Match.find({ emergencyRequestId: request._id }).sort({ rank: 1, _id: 1 });
    if (existing.length > 0) return existing;
    throw new Error(`Request is already ${request.status.toLowerCase()}`);
  }

  // A retry replaces stale pending matches instead of creating duplicate
  // notifications and ranks.
  await Match.deleteMany({ emergencyRequestId: request._id, status: { $in: ['PENDING', 'NOTIFIED'] } });
  request.status = 'MATCHING';
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

  // Query Blood Banks
  const bloodBanks = await BloodBank.aggregate([
    {
      $geoNear: {
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
    const inventoryItems = await Inventory.find({
      bloodBankId: bb._id,
      bloodGroup: { $in: compatibleGroups },
      component: request.component,
      availableUnits: { $gt: 0 },
      operationallyUnavailable: { $ne: true },
      status: { $ne: 'UNAVAILABLE' },
    });

    for (const inv of inventoryItems) {
      const user = await User.findOne({
        _id: bb.userId,
        isActive: true,
        verificationStatus: 'VERIFIED',
      }).lean();
      if (!user) continue;

      const responseRate = bb.totalResponseCount > 0 ? bb.acceptedResponseCount / bb.totalResponseCount : -1;
      
      const matchResult = calculateMatchScore({
        recipientBloodGroup: request.bloodGroup as BloodGroup,
        donorBloodGroup: inv.bloodGroup as BloodGroup,
        component: request.component as ComponentType,
        distanceKm: bbDistanceKm,
        availableQuantity: inv.availableUnits,
        requestedQuantity: request.quantity,
        isVerified: user.verificationStatus === 'VERIFIED',
        responseRate,
        severity: request.severity,
        requiredBy: request.requiredBy,
        asOf: request.matchingStartedAt,
      });

      allMatches.push({
        emergencyRequestId: request._id,
        resourceType: 'BLOOD_BANK',
        resourceId: bb._id,
        resourceUserId: bb.userId,
        score: matchResult.score,
        factors: matchResult.factors,
        compatibilityType: matchResult.compatibilityType,
        distanceKm: bbDistanceKm,
        availableQuantity: inv.availableUnits,
        isVerified: user.verificationStatus === 'VERIFIED',
        reasons: matchResult.reasons,
        status: 'PENDING',
      });
    }
  }

  // Query Donors
  const donors = await Donor.aggregate([
    {
      $geoNear: {
        near: requestPoint,
        distanceField: 'distance',
        maxDistance: request.searchRadiusKm * 1000,
        spherical: true,
      },
    },
    {
      $match: {
        bloodGroup: { $in: compatibleGroups },
        availabilityStatus: { $nin: ['UNAVAILABLE', 'TEMPORARILY_UNAVAILABLE'] },
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
  const createdMatches = await Match.insertMany(rankedMatches);

  // Update request
  request.status = createdMatches.length > 0 ? 'RESOURCES_NOTIFIED' : 'ESCALATED';
  request.responseDeadline = createdMatches.length > 0
    ? new Date(Date.now() + request.responseTimeoutMinutes * 60 * 1000)
    : undefined;
  request.matchCount = createdMatches.length;
  await request.save();

  // Create notifications for top 10 matches
  const top10 = createdMatches.slice(0, 10);
  if (top10.length > 0) {
    await Match.updateMany(
      { _id: { $in: top10.map((match) => match._id) } },
      { $set: { status: 'NOTIFIED', notifiedAt: new Date() } }
    );
    top10.forEach((match) => {
      match.status = 'NOTIFIED';
      match.notifiedAt = new Date();
    });
  }
  await Promise.all(top10.map((match) => createNotification({
    userId: match.resourceUserId.toString(),
    type: 'NEW_MATCH',
    title: 'Emergency Blood Request Match',
    message: `You have been matched for an emergency request of ${request.quantity} units of ${request.bloodGroup} ${request.component}. Respond before ${request.responseDeadline?.toISOString()}.`,
    severity: request.severity,
    referenceType: 'MATCH',
    referenceId: match._id.toString(),
  })));

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

export async function getMatchesForRequest(emergencyRequestId: string) {
  await connectToDatabase();
  const request = await EmergencyRequest.findOne(
    mongoose.Types.ObjectId.isValid(emergencyRequestId)
      ? { _id: emergencyRequestId }
      : { requestId: emergencyRequestId }
  ).select('_id');
  if (!request) throw new Error('Emergency request not found');

  const matches = await Match.find({ emergencyRequestId: request._id })
    .sort({ rank: 1, _id: 1 })
    .populate('resourceUserId');

  // resourceId is intentionally polymorphic in Match, so Mongoose cannot
  // populate it from the schema. Hydrate the resource for the UI explicitly.
  return Promise.all(matches.map(async (match) => {
    const resource = match.resourceType === 'BLOOD_BANK'
      ? await BloodBank.findById(match.resourceId).lean()
      : await Donor.findById(match.resourceId).lean();
    const value = match.toObject();
    return {
      ...value,
      resourceUser: value.resourceUserId,
      [match.resourceType === 'BLOOD_BANK' ? 'bloodBank' : 'donor']: resource,
    };
  }));
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

  const AuditLogModel = getAuditLogModel();

  if (accept) {
    match.status = 'ACCEPTED';
    match.respondedAt = new Date();
    await match.save();

    await reserveAcceptedMatch(match._id.toString(), { userId, userName: 'Resource User' });

    request.responseCount += 1;
    if (request.responseCount === 1) {
      request.firstResponseAt = new Date();
    }
    
    // Move to RESPONSES_RECEIVED if it's currently in RESOURCES_NOTIFIED
    if (request.status === 'RESOURCES_NOTIFIED' || request.status === 'ESCALATED') {
      request.status = 'RESPONSES_RECEIVED';
    }
    
    await request.save();

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
    match.status = 'DECLINED';
    match.respondedAt = new Date();
    match.declineReason = declineReason;

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
  }

  await match.save();
  return match;
}
