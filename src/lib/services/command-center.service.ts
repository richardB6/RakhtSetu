import { connectToDatabase } from '@/lib/db/mongodb';
import { AuditLog } from '@/models/AuditLog';
import { BloodBank } from '@/models/BloodBank';
import { Donor } from '@/models/Donor';
import { EmergencyRequest } from '@/models/EmergencyRequest';
import { Hospital } from '@/models/Hospital';
import { Inventory } from '@/models/Inventory';
import { Match } from '@/models/Match';
import { Notification } from '@/models/Notification';
import { Reservation } from '@/models/Reservation';
import { User } from '@/models/User';
import { ACTIVE_STATUSES } from '@/lib/engine/compatibility';
import { calculatePercentage, canViewRoleDashboard, getCommandCenterRange, getResponseStatus } from '@/lib/engine/command-center-policy';
export { calculatePercentage, canViewRoleDashboard, getCommandCenterRange, getResponseStatus } from '@/lib/engine/command-center-policy';

const RESOURCE_MATCH_STATUSES = ['PENDING', 'NOTIFIED', 'ACCEPTED', 'RESERVED', 'FULFILLED', 'DECLINED', 'EXPIRED', 'CANCELLED'];

export interface CommandCenterFilters {
  severity?: string;
  status?: string;
  component?: string;
  search?: string;
  days?: number;
  from?: string;
  to?: string;
}

export interface CommandCenterUser {
  userId: string;
  role: 'ADMIN' | 'HOSPITAL' | 'BLOOD_BANK' | 'DONOR';
}

function asId(value: unknown) {
  return value && typeof value === 'object' && '_id' in value ? String((value as { _id: unknown })._id) : String(value);
}

async function getScope(user: CommandCenterUser) {
  if (user.role === 'ADMIN') return {};
  if (user.role === 'HOSPITAL') {
    const hospital = await Hospital.findOne({ userId: user.userId }).select('_id').lean();
    return { hospitalId: hospital?._id || null };
  }

  const matches = await Match.find({ resourceUserId: user.userId }).distinct('emergencyRequestId');
  return { _id: { $in: matches } };
}

function applyFilters(query: Record<string, unknown>, filters: CommandCenterFilters) {
  if (filters.severity && filters.severity !== 'ALL') query.severity = filters.severity;
  if (filters.status && filters.status !== 'ALL') query.status = filters.status;
  if (filters.component && filters.component !== 'ALL') query.component = filters.component;
  if (filters.search) {
    query.$or = [
      { requestId: { $regex: filters.search, $options: 'i' } },
      { patientReference: { $regex: filters.search, $options: 'i' } },
      { city: { $regex: filters.search, $options: 'i' } },
    ];
  }
}

function buildAlert(request: Record<string, any>, type: string, title: string, message: string) {
  return {
    id: `${type}-${request._id}`,
    requestId: request._id,
    requestCode: request.requestId,
    type,
    title,
    message,
    severity: request.severity,
    createdAt: request.updatedAt || request.createdAt,
  };
}

export async function getCommandCenterData(user: CommandCenterUser, filters: CommandCenterFilters = {}) {
  await connectToDatabase();
  const scope = await getScope(user);
  const query: Record<string, any> = { ...scope };
  applyFilters(query, filters);

  const days = Math.min(Math.max(Number(filters.days) || 30, 1), 90);
  const { since, until } = getCommandCenterRange(days, filters.from, filters.to);
  const [requests, total, requestIds] = await Promise.all([
    EmergencyRequest.find(query)
      .populate('hospitalId', 'name city state')
      .sort({ severity: -1, requiredBy: 1, createdAt: -1 })
      .limit(100)
      .lean(),
    EmergencyRequest.countDocuments(query),
    EmergencyRequest.find(query).select('_id').lean(),
  ]);
  const ids = requestIds.map((request) => request._id);
  const matchQuery: Record<string, unknown> = { emergencyRequestId: { $in: ids } };

  const [matches, activity, inventorySummary, verifiedBanks, verifiedDonors, verifiedHospitals, verificationQueue] = await Promise.all([
    Match.find(matchQuery).select('emergencyRequestId resourceType status respondedAt notifiedAt resourceUserId createdAt').lean(),
    AuditLog.find({ entityType: 'EmergencyRequest', entityId: { $in: ids } })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean(),
    Inventory.aggregate([
      { $match: { availableUnits: { $gt: 0 }, operationallyUnavailable: { $ne: true }, status: { $ne: 'UNAVAILABLE' } } },
      { $group: { _id: null, availableUnits: { $sum: '$availableUnits' }, reservedUnits: { $sum: '$reservedUnits' }, records: { $sum: 1 } } },
    ]),
    BloodBank.aggregate([
      { $match: { operationalStatus: { $in: ['OPEN', 'LIMITED'] } } },
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $match: { 'user.isActive': true, 'user.verificationStatus': 'VERIFIED' } },
      { $lookup: { from: 'inventories', let: { bankId: '$_id' }, pipeline: [{ $match: { $expr: { $eq: ['$bloodBankId', '$$bankId'] }, availableUnits: { $gt: 0 }, operationallyUnavailable: { $ne: true }, status: { $ne: 'UNAVAILABLE' } } }], as: 'inventory' } },
      { $match: { 'inventory.0': { $exists: true } } },
      { $count: 'count' },
    ]),
    Donor.aggregate([
      { $match: { isAvailable: true, emergencyNotificationsEnabled: true } },
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
      { $match: { 'user.isActive': true, 'user.verificationStatus': 'VERIFIED' } },
      { $count: 'count' },
    ]),
    Hospital.countDocuments({}),
    User.countDocuments({ verificationStatus: 'PENDING' }),
  ]);

  const matchByRequest = new Map<string, typeof matches>();
  for (const match of matches) {
    const key = asId(match.emergencyRequestId);
    const current = matchByRequest.get(key) || [];
    current.push(match);
    matchByRequest.set(key, current);
  }

  const board = requests.map((request) => {
    const requestMatches = matchByRequest.get(asId(request._id)) || [];
    return {
      ...request,
      matchCount: requestMatches.length,
      responseStatus: getResponseStatus(requestMatches.map((match) => match.status)),
    };
  });

  const now = Date.now();
  const alerts = requests.flatMap((request) => {
    const result = [];
    if (request.severity === 'CRITICAL' && ACTIVE_STATUSES.includes(request.status as never)) {
      result.push(buildAlert(request, 'CRITICAL_UNFULFILLED', 'Critical request needs attention', `${request.requestId} remains ${request.status.toLowerCase()}.`));
    }
    if (request.status === 'ESCALATED') {
      result.push(buildAlert(request, 'ESCALATED', 'Request escalated', `${request.requestId} requires coordinator attention.`));
    }
    if (ACTIVE_STATUSES.includes(request.status as never) && new Date(request.requiredBy).getTime() <= now + 2 * 60 * 60 * 1000) {
      result.push(buildAlert(request, 'DUE_SOON', 'Required-by time approaching', `${request.requestId} is due within two hours.`));
    }
    const requestMatches = matchByRequest.get(asId(request._id)) || [];
    if (requestMatches.some((match) => ['DECLINED', 'EXPIRED'].includes(match.status))) {
      result.push(buildAlert(request, 'FAILED_RESPONSE', 'Response requires follow-up', `${request.requestId} has declined or expired responses.`));
    }
    return result;
  }).slice(0, 30);

  const responseTimes = matches
    .filter((match) => match.createdAt >= since && match.createdAt <= until && match.respondedAt && match.notifiedAt)
    .map((match) => (new Date(match.respondedAt!).getTime() - new Date(match.notifiedAt!).getTime()) / 60000)
    .filter((minutes) => minutes >= 0);
  const avgResponseTimeMinutes = responseTimes.length ? responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length : null;
  const analyticsRequestQuery = { ...query, createdAt: { $gte: since, $lte: until } };
  const analyticsRequests = await EmergencyRequest.find(analyticsRequestQuery)
    .select('status createdAt matchingStartedAt fulfilledAt')
    .limit(5000)
    .lean();
  const fulfilled = analyticsRequests.filter((request) => request.status === 'FULFILLED').length;
  const denominator = analyticsRequests.filter((request) => request.status !== 'DRAFT').length;
  const matchingTimes = analyticsRequests.filter((request) => request.matchingStartedAt).map((request) => (new Date(request.matchingStartedAt!).getTime() - new Date(request.createdAt).getTime()) / 60000).filter((value) => value >= 0);
  const fulfillmentTimes = analyticsRequests.filter((request) => request.fulfilledAt).map((request) => (new Date(request.fulfilledAt!).getTime() - new Date(request.createdAt).getTime()) / 60000).filter((value) => value >= 0);
  const analyticsMatches = await Match.find({ ...matchQuery, createdAt: { $gte: since, $lte: until } }).select('status notifiedAt respondedAt resourceType').lean();
  const notifiedCount = analyticsMatches.filter((match) => match.notifiedAt).length;
  const respondedCount = analyticsMatches.filter((match) => match.respondedAt || ['ACCEPTED', 'DECLINED', 'RESERVED', 'FULFILLED'].includes(match.status)).length;
  const acceptedCount = analyticsMatches.filter((match) => ['ACCEPTED', 'RESERVED', 'FULFILLED'].includes(match.status)).length;
  const escalatedCount = analyticsRequests.filter((request) => request.status === 'ESCALATED').length;
  const fulfillmentByResourceType = await Match.aggregate([{ $match: { ...matchQuery, createdAt: { $gte: since, $lte: until }, status: 'FULFILLED' } }, { $group: { _id: '$resourceType', count: { $sum: 1 } } }]);
  const byHour = await EmergencyRequest.aggregate([{ $match: analyticsRequestQuery }, { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]);

  const [byDay, byStatus, bySeverity, byComponent, byBloodGroup, byLocation, responseByDay] = await Promise.all([
    EmergencyRequest.aggregate([{ $match: analyticsRequestQuery }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    EmergencyRequest.aggregate([{ $match: analyticsRequestQuery }, { $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    EmergencyRequest.aggregate([{ $match: analyticsRequestQuery }, { $group: { _id: '$severity', count: { $sum: 1 } } }]),
    EmergencyRequest.aggregate([{ $match: analyticsRequestQuery }, { $group: { _id: '$component', count: { $sum: 1 } } }]),
    EmergencyRequest.aggregate([{ $match: analyticsRequestQuery }, { $group: { _id: '$bloodGroup', count: { $sum: 1 } } }]),
    EmergencyRequest.aggregate([{ $match: analyticsRequestQuery }, { $group: { _id: '$city', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Match.aggregate([{ $match: { ...matchQuery, createdAt: { $gte: since, $lte: until }, respondedAt: { $exists: true }, notifiedAt: { $exists: true } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$respondedAt' } }, averageMinutes: { $avg: { $divide: [{ $subtract: ['$respondedAt', '$notifiedAt'] }, 60000] } } } }, { $sort: { _id: 1 } }]),
  ]);

  let roleDashboard: Record<string, unknown> | undefined;
  if (canViewRoleDashboard(user.role, 'HOSPITAL') && user.role === 'HOSPITAL') {
    roleDashboard = {
      type: 'HOSPITAL',
      activeRequests: analyticsRequests.filter((request) => ACTIVE_STATUSES.includes(request.status as never)).length,
      criticalRequests: analyticsRequests.filter((request) => request.status !== 'FULFILLED').length,
      pendingMatches: matches.filter((match) => ['PENDING', 'NOTIFIED'].includes(match.status)).length,
      acceptedMatches: matches.filter((match) => ['ACCEPTED', 'RESERVED'].includes(match.status)).length,
      fulfilledRequests: analyticsRequests.filter((request) => request.status === 'FULFILLED').length,
      recentEmergencies: requests.slice(0, 8),
    };
  } else if (canViewRoleDashboard(user.role, 'BLOOD_BANK') && user.role === 'BLOOD_BANK') {
    const bank = await BloodBank.findOne({ userId: user.userId }).select('_id name operationalStatus').lean();
    const [inventory, recentNotifications, bankActivity, activeReservations] = await Promise.all([
      bank ? Inventory.aggregate([{ $match: { bloodBankId: bank._id } }, { $group: { _id: null, availableUnits: { $sum: '$availableUnits' }, reservedUnits: { $sum: '$reservedUnits' } } }]) : [],
      Notification.find({ userId: user.userId }).select('title message severity createdAt isRead').sort({ createdAt: -1 }).limit(8).lean(),
      AuditLog.find({ userId: user.userId }).select('action description createdAt').sort({ createdAt: -1 }).limit(8).lean(),
      Reservation.countDocuments({ resourceUserId: user.userId, status: 'ACTIVE' }),
    ]);
    roleDashboard = {
      type: 'BLOOD_BANK',
      bank,
      inventory: inventory[0] || { availableUnits: 0, reservedUnits: 0 },
      incomingRequests: requests.slice(0, 8),
      pendingResponses: matches.filter((match) => ['PENDING', 'NOTIFIED'].includes(match.status)).length,
      acceptedRequests: matches.filter((match) => ['ACCEPTED', 'RESERVED'].includes(match.status)).length,
      fulfillmentHistory: matches.filter((match) => match.status === 'FULFILLED').length,
      activeReservations,
      recentNotifications,
      activity: bankActivity,
    };
  }

  return {
    filters: { days, since, until, total },
    stats: {
      activeEmergencies: await EmergencyRequest.countDocuments({ ...scope, status: { $in: ACTIVE_STATUSES } }),
      criticalRequests: await EmergencyRequest.countDocuments({ ...scope, status: { $in: ACTIVE_STATUSES }, severity: 'CRITICAL' }),
      matchingInProgress: await EmergencyRequest.countDocuments({ ...scope, status: 'MATCHING' }),
      availableResources: (verifiedBanks[0]?.count || 0) + (verifiedDonors[0]?.count || 0),
      avgResponseTimeMinutes,
      fulfillmentRate: calculatePercentage(fulfilled, denominator),
      totalFulfilled: fulfilled,
      verificationQueue,
    },
    board,
    alerts,
    activity: activity.map((event) => ({ id: event._id, requestId: event.entityId, action: event.action, description: event.description, userName: event.userName, createdAt: event.createdAt })),
    resources: { verifiedBanks: verifiedBanks[0]?.count || 0, verifiedDonors: verifiedDonors[0]?.count || 0, verifiedHospitals, availableResources: (verifiedBanks[0]?.count || 0) + (verifiedDonors[0]?.count || 0), inventory: inventorySummary[0] || { availableUnits: 0, reservedUnits: 0, records: 0 } },
    roleDashboard,
    analytics: { since, until, byDay, byStatus, bySeverity, byComponent, byBloodGroup, byLocation, byHour, responseByDay, fulfillmentByResourceType, averageResponseTimeMinutes: avgResponseTimeMinutes, medianResponseTimeMinutes: median(responseTimes), averageMatchingTimeMinutes: matchingTimes.length ? matchingTimes.reduce((sum, value) => sum + value, 0) / matchingTimes.length : null, averageFulfillmentTimeMinutes: fulfillmentTimes.length ? fulfillmentTimes.reduce((sum, value) => sum + value, 0) / fulfillmentTimes.length : null, fulfillmentRate: calculatePercentage(fulfilled, denominator), escalationRate: calculatePercentage(escalatedCount, denominator), resourceResponseRate: calculatePercentage(respondedCount, notifiedCount), resourceAcceptanceRate: calculatePercentage(acceptedCount, respondedCount) },
  };
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}