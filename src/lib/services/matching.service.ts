import mongoose from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import { EmergencyRequest } from '@/models/EmergencyRequest';
import { Match } from '@/models/Match';
import { Inventory } from '@/models/Inventory';
import { BloodBank } from '@/models/BloodBank';
import { Donor } from '@/models/Donor';
import { User } from '@/models/User';
import { getCompatibleDonorGroups, getCompatibilityLevel, ComponentType, BloodGroup } from '@/lib/engine/compatibility';

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
  const hoursUntilRequired = (requiredBy.getTime() - Date.now()) / (1000 * 60 * 60);
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
  if (isVerified) reasons.push('Verified resource');
  if (responseRate > 0.8) reasons.push('High response reliability');

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

export async function runMatchingEngine(emergencyRequestId: string, userId: string) {
  await connectToDatabase();
  
  const request = await EmergencyRequest.findById(emergencyRequestId);
  if (!request) {
    throw new Error('Emergency request not found');
  }

  request.status = 'MATCHING';
  request.matchingStartedAt = new Date();
  await request.save();

  const compatibleGroups = getCompatibleDonorGroups(request.bloodGroup as BloodGroup, request.component as ComponentType);
  if (compatibleGroups.length === 0) {
    throw new Error('No compatible blood groups found for this component');
  }

  const allMatches = [];

  // Query Blood Banks
  const bloodBanks = await BloodBank.aggregate([
    {
      $geoNear: {
        near: request.location,
        distanceField: 'distance',
        maxDistance: request.searchRadiusKm * 1000,
        spherical: true,
      },
    },
    { $match: { isOpen: true } },
  ]);

  for (const bb of bloodBanks) {
    const bbDistanceKm = bb.distance / 1000;
    
    // Check inventory
    const inventoryItems = await Inventory.find({
      bloodBankId: bb._id,
      bloodGroup: { $in: compatibleGroups },
      component: request.component,
      availableUnits: { $gt: 0 },
    });

    for (const inv of inventoryItems) {
      const user = await User.findById(bb.userId);
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
        near: request.location,
        distanceField: 'distance',
        maxDistance: request.searchRadiusKm * 1000,
        spherical: true,
      },
    },
    {
      $match: {
        bloodGroup: { $in: compatibleGroups },
        isAvailable: true,
        emergencyNotificationsEnabled: true,
      },
    },
  ]);

  for (const donor of donors) {
    const donorDistanceKm = donor.distance / 1000;
    const user = await User.findById(donor.userId);
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
  allMatches.sort((a, b) => b.score - a.score);
  
  const rankedMatches = allMatches.map((m, idx) => ({ ...m, rank: idx + 1 }));

  // Save matches to DB
  const createdMatches = await Match.insertMany(rankedMatches);

  // Update request
  request.status = 'RESOURCES_NOTIFIED';
  request.matchCount = createdMatches.length;
  await request.save();

  // Create notifications for top 10 matches
  const NotificationModel = getNotificationModel();
  const top10 = createdMatches.slice(0, 10);
  const notifications = top10.map((match) => ({
    userId: match.resourceUserId,
    type: 'NEW_MATCH',
    title: 'Emergency Blood Request Match',
    message: `You have been matched for an emergency request of ${request.quantity} units of ${request.bloodGroup} ${request.component}.`,
    severity: request.severity,
    referenceType: 'MATCH',
    referenceId: match._id,
    channel: 'IN_APP',
    deliveryStatus: 'PENDING',
    isRead: false,
    createdAt: new Date(),
  }));
  if (notifications.length > 0) {
    await NotificationModel.insertMany(notifications);
  }

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
  
  const matches = await Match.find({ emergencyRequestId })
    .sort({ score: -1 })
    .populate('resourceUser');
    
  return matches;
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
  const NotificationModel = getNotificationModel();

  if (accept) {
    match.status = 'ACCEPTED';
    match.respondedAt = new Date();

    if (match.resourceType === 'BLOOD_BANK') {
      const bb = await BloodBank.findById(match.resourceId);
      if (bb) {
        // Find specific inventory entry and reserve it
        const inv = await Inventory.findOne({
          bloodBankId: bb._id,
          component: request.component,
          availableUnits: { $gt: 0 }
        });
        
        if (inv) {
          const unitsToReserve = Math.min(request.quantity - request.quantityFulfilled, inv.availableUnits, request.quantity);
          if (unitsToReserve > 0) {
            inv.availableUnits -= unitsToReserve;
            inv.reservedUnits += unitsToReserve;
            match.reservedQuantity = unitsToReserve;
            await inv.save();
          }
        }
      }
    }

    request.responseCount += 1;
    if (request.responseCount === 1) {
      request.firstResponseAt = new Date();
    }
    
    // Move to RESPONSES_RECEIVED if it's currently in RESOURCES_NOTIFIED
    if (request.status === 'RESOURCES_NOTIFIED') {
      request.status = 'RESPONSES_RECEIVED';
    }
    
    await request.save();

    await NotificationModel.create({
      userId: request.createdBy,
      type: 'MATCH_ACCEPTED',
      title: 'Resource Accepted Request',
      message: `A resource has accepted your request for ${request.bloodGroup} ${request.component}.`,
      severity: 'INFO',
      referenceType: 'MATCH',
      referenceId: match._id,
      channel: 'IN_APP',
      deliveryStatus: 'PENDING',
      isRead: false,
      createdAt: new Date(),
    });

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
