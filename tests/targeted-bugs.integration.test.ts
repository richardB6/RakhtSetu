import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import fs from 'node:fs';
import mongoose from 'mongoose';
import { BloodBank } from '../src/models/BloodBank.ts';
import { Donor, type IDonor, type DonorAvailabilityStatus } from '../src/models/Donor.ts';
import { EmergencyRequest, type IEmergencyRequest } from '../src/models/EmergencyRequest.ts';
import { Inventory } from '../src/models/Inventory.ts';
import { InventoryHistory } from '../src/models/InventoryHistory.ts';
import { Match } from '../src/models/Match.ts';
import { Notification } from '../src/models/Notification.ts';
import { Reservation } from '../src/models/Reservation.ts';
import { User, type IUserDocument } from '../src/models/User.ts';
import { Verification } from '../src/models/Verification.ts';
import { Hospital } from '../src/models/Hospital.ts';
import { AuditLog } from '../src/models/AuditLog.ts';

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const separator = line.indexOf('=');
  if (separator > 0 && !line.startsWith('#')) {
    const key = line.slice(0, separator);
    if (!process.env[key]) process.env[key] = line.slice(separator + 1);
  }
}

type ApiContext = { params: Promise<Record<string, string | string[]>> };
type ApiHandler = (request: import('next/server').NextRequest, context: ApiContext) => Promise<Response>;

let connectToDatabase: typeof import('../src/lib/db/mongodb.ts').connectToDatabase;
let signAccessToken: typeof import('../src/lib/auth/jwt.ts').signAccessToken;
let runMatchingEngine: typeof import('../src/lib/services/matching.service.ts').runMatchingEngine;
let backfillEligibleDonorMatchNotifications: typeof import('../src/lib/services/matching.service.ts').backfillEligibleDonorMatchNotifications;
let reserveAcceptedMatch: typeof import('../src/lib/services/reservation.service.ts').reserveAcceptedMatch;
let releaseMatchReservation: typeof import('../src/lib/services/reservation.service.ts').releaseMatchReservation;
let getDonorDashboard: ApiHandler;
let getNearbyResources: ApiHandler;
let getAvailability: ApiHandler;
let patchAvailability: ApiHandler;
let getNotifications: ApiHandler;
let getInventoryRoute: ApiHandler;
let getVerification: ApiHandler;
let patchVerification: ApiHandler;
let initialVerificationStatus: typeof import('../src/app/api/auth/register/route.ts').initialVerificationStatus;
let cookieName: typeof import('../src/lib/auth/cookies.ts').COOKIE_NAMES.ACCESS_TOKEN;
let servicesLoaded = false;

async function loadServices() {
  if (servicesLoaded) return;
  ({ connectToDatabase } = await import('../src/lib/db/mongodb.ts'));
  ({ signAccessToken } = await import('../src/lib/auth/jwt.ts'));
  ({ runMatchingEngine, backfillEligibleDonorMatchNotifications } = await import('../src/lib/services/matching.service.ts'));
  ({ reserveAcceptedMatch, releaseMatchReservation } = await import('../src/lib/services/reservation.service.ts'));
  ({ GET: getDonorDashboard } = await import('../src/app/api/donor/dashboard/route.ts'));
  ({ GET: getNearbyResources } = await import('../src/app/api/resources/nearby/route.ts'));
  ({ GET: getAvailability, PATCH: patchAvailability } = await import('../src/app/api/donor/availability/route.ts'));
  ({ GET: getNotifications } = await import('../src/app/api/notifications/route.ts'));
  ({ GET: getInventoryRoute } = await import('../src/app/api/inventory/route.ts'));
  ({ GET: getVerification, PATCH: patchVerification } = await import('../src/app/api/admin/verification/route.ts'));
  ({ initialVerificationStatus } = await import('../src/app/api/auth/register/route.ts'));
  ({ COOKIE_NAMES: { ACCESS_TOKEN: cookieName } } = await import('../src/lib/auth/cookies.ts'));
  servicesLoaded = true;
}

const prefix = `targeted-bugfix-${Date.now()}`;
const testLocation = { type: 'Point', coordinates: [0, 0] };
const created = {
  userIds: [] as mongoose.Types.ObjectId[],
  hospitalIds: [] as mongoose.Types.ObjectId[],
  bloodBankIds: [] as mongoose.Types.ObjectId[],
  donorIds: [] as mongoose.Types.ObjectId[],
  requestIds: [] as mongoose.Types.ObjectId[],
  matchIds: [] as mongoose.Types.ObjectId[],
  inventoryIds: [] as mongoose.Types.ObjectId[],
  verificationIds: [] as mongoose.Types.ObjectId[],
};

async function requireDatabase(t: { skip: (reason?: string) => void }) {
  try {
    await loadServices();
    await connectToDatabase();
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown MongoDB connection error';
    t.skip(`MongoDB integration unavailable: ${message}`);
    return false;
  }
  return true;
}

async function makeUser(
  role: 'HOSPITAL' | 'BLOOD_BANK' | 'DONOR' | 'ADMIN',
  suffix: string,
  verificationStatus: IUserDocument['verificationStatus'] = 'VERIFIED'
) {
  const user = await User.create({
    email: `${prefix}-${suffix}@example.invalid`,
    password: 'integration-test-password',
    name: `${prefix} ${suffix}`,
    phone: '9999999999',
    role,
    verificationStatus,
  });
  created.userIds.push(user._id);
  return user;
}

async function makeHospital(userId: mongoose.Types.ObjectId, suffix: string) {
  const hospital = await Hospital.create({
    userId,
    name: `${prefix} ${suffix}`,
    registrationNumber: `${prefix}-${suffix}`,
    type: 'PRIVATE',
    address: 'Integration Test Address',
    city: 'Test City',
    state: 'Test State',
    pincode: '400001',
    location: testLocation,
    contactPerson: 'Test Contact',
    contactPhone: '9999999999',
    contactEmail: `${prefix}-${suffix}@example.invalid`,
    operatingHours: '24/7',
  });
  created.hospitalIds.push(hospital._id);
  return hospital;
}

async function makeBank(userId: mongoose.Types.ObjectId, suffix: string) {
  const bank = await BloodBank.create({
    userId,
    name: `${prefix} ${suffix}`,
    licenseNumber: `${prefix}-${suffix}`,
    type: 'STANDALONE',
    address: 'Integration Test Address',
    city: 'Test City',
    state: 'Test State',
    pincode: '400001',
    location: testLocation,
    contactPerson: 'Test Contact',
    contactPhone: '9999999999',
    contactEmail: `${prefix}-${suffix}@example.invalid`,
    operatingHours: '24/7',
    operationalStatus: 'OPEN',
    componentCapabilities: ['PRBC'],
  });
  created.bloodBankIds.push(bank._id);
  return bank;
}

async function makeDonor(
  userId: mongoose.Types.ObjectId,
  suffix: string,
  bloodGroup: IDonor['bloodGroup'] = 'A+',
  availabilityStatus: DonorAvailabilityStatus = 'AVAILABLE'
) {
  const donor = await Donor.create({
    userId,
    bloodGroup,
    address: 'Integration Test Address',
    city: 'Test City',
    state: 'Test State',
    pincode: '400001',
    location: testLocation,
    availabilityStatus,
    isAvailable: availabilityStatus === 'AVAILABLE',
    availabilityRadius: 100,
    emergencyNotificationsEnabled: true,
  });
  created.donorIds.push(donor._id);
  return donor;
}

async function makeRequest(
  hospital: InstanceType<typeof Hospital>,
  userId: mongoose.Types.ObjectId,
  suffix: string,
  options: { status?: IEmergencyRequest['status']; requiredBy?: Date } = {}
) {
  const request = await EmergencyRequest.create({
    requestId: `${prefix}-${suffix}`,
    hospitalId: hospital._id,
    createdBy: userId,
    patientReference: `${prefix}-patient-${suffix}`,
    bloodGroup: 'A+',
    component: 'PRBC',
    quantity: 2,
    quantityFulfilled: 0,
    severity: 'HIGH',
    requiredBy: options.requiredBy || new Date(Date.now() + 2 * 60 * 60 * 1000),
    location: hospital.location,
    address: hospital.address,
    city: hospital.city,
    status: options.status || 'CREATED',
    contactPerson: hospital.contactPerson,
    contactPhone: hospital.contactPhone,
    searchRadiusKm: 100,
    matchCount: 0,
    responseCount: 0,
    responseTimeoutMinutes: 15,
    escalationLevel: 0,
  });
  created.requestIds.push(request._id);
  return request;
}

async function makeMatch(
  request: InstanceType<typeof EmergencyRequest>,
  resourceUserId: mongoose.Types.ObjectId,
  resourceId: mongoose.Types.ObjectId,
  suffix: string,
  resourceType: 'BLOOD_BANK' | 'DONOR' = 'DONOR',
  status: 'PENDING' | 'NOTIFIED' | 'ACCEPTED' = 'PENDING'
) {
  const match = await Match.create({
    emergencyRequestId: request._id,
    resourceType,
    resourceId,
    resourceUserId,
    score: 90,
    rank: 1,
    factors: { compatibilityScore: 100, availabilityScore: 100, distanceScore: 100, verificationScore: 100, responseReliabilityScore: 60, urgencyScore: 70 },
    compatibilityType: 'EXACT',
    distanceKm: 1,
    availableQuantity: 2,
    isVerified: true,
    reasons: [suffix],
    status,
  });
  created.matchIds.push(match._id);
  return match;
}

async function makeToken(user: InstanceType<typeof User>) {
  return signAccessToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    name: user.name,
    verificationStatus: user.verificationStatus,
  });
}

async function callApi(
  handler: ApiHandler,
  path: string,
  token: string,
  method = 'GET',
  body?: unknown,
  params: Record<string, string> = {}
) {
  const { NextRequest } = await import('next/server');
  const request = new NextRequest(`http://localhost${path}`, {
    method,
    headers: {
      cookie: `${cookieName}=${token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return handler(request, { params: Promise.resolve(params) });
}

async function cleanup() {
  if (mongoose.connection.readyState !== 1) return;
  await Notification.deleteMany({ $or: [
    { userId: { $in: created.userIds } },
    { referenceId: { $in: created.matchIds } },
  ] });
  await AuditLog.deleteMany({ $or: [
    { userId: { $in: created.userIds } },
    { entityId: { $in: created.donorIds } },
  ] });
  await Reservation.deleteMany({ $or: [
    { emergencyRequestId: { $in: created.requestIds } },
    { matchId: { $in: created.matchIds } },
  ] });
  await InventoryHistory.deleteMany({ $or: [
    { bloodBankId: { $in: created.bloodBankIds } },
    { matchId: { $in: created.matchIds } },
  ] });
  await Match.deleteMany({ $or: [
    { _id: { $in: created.matchIds } },
    { emergencyRequestId: { $in: created.requestIds } },
  ] });
  await EmergencyRequest.deleteMany({ _id: { $in: created.requestIds } });
  await Inventory.deleteMany({ _id: { $in: created.inventoryIds } });
  await Verification.deleteMany({ $or: [
    { _id: { $in: created.verificationIds } },
    { userId: { $in: created.userIds } },
  ] });
  await Donor.deleteMany({ _id: { $in: created.donorIds } });
  await BloodBank.deleteMany({ _id: { $in: created.bloodBankIds } });
  await Hospital.deleteMany({ _id: { $in: created.hospitalIds } });
  await User.deleteMany({ _id: { $in: created.userIds } });
}

test('donor dashboard data and geospatial routes work with multiple location indexes', async (t) => {
  if (!(await requireDatabase(t))) return;
  try {
    const donorUser = await makeUser('DONOR', 'geo-donor');
    const bankUser = await makeUser('BLOOD_BANK', 'geo-bank');
    const hospitalUser = await makeUser('HOSPITAL', 'geo-hospital');
    const donor = await makeDonor(donorUser._id, 'geo-donor');
    const bank = await makeBank(bankUser._id, 'geo-bank');
    await makeHospital(hospitalUser._id, 'geo-hospital');
    const token = await makeToken(donorUser);

    const dashboard = await callApi(getDonorDashboard, '/api/donor/dashboard', token);
    assert.equal(dashboard.status, 200);
    const dashboardData = (await dashboard.json()).data;
    assert.equal(dashboardData.profile.bloodGroup, donor.bloodGroup);
    assert.equal(dashboardData.availability.verificationStatus, 'VERIFIED');

    const nearby = await callApi(
      getNearbyResources,
      '/api/resources/nearby?lat=0&lng=0&radiusKm=10',
      await makeToken(hospitalUser)
    );
    assert.equal(nearby.status, 200);
    const resources = (await nearby.json()).data;
    assert.ok(resources.some((resource: { id: string; type: string }) => resource.id === bank._id.toString() && resource.type === 'BLOOD_BANK'));
  } finally {
    await cleanup();
  }
});

test('donor verification starts pending and the admin workflow persists and exposes decisions', async (t) => {
  if (!(await requireDatabase(t))) return;
  try {
    assert.equal(initialVerificationStatus('DONOR'), 'PENDING');
    const admin = await makeUser('ADMIN', 'verification-admin');
    const donorUser = await makeUser('DONOR', 'pending-donor', 'PENDING');
    const donor = await makeDonor(donorUser._id, 'pending-donor');
    const verification = await Verification.create({ userId: donorUser._id, entityType: 'DONOR', status: 'PENDING' });
    created.verificationIds.push(verification._id);
    const token = await makeToken(admin);
    const donorToken = await makeToken(donorUser);

    const pending = await callApi(getVerification, '/api/admin/verification?status=PENDING', token);
    assert.equal(pending.status, 200);
    const entry = (await pending.json()).data.find((row: { user: { _id: string } }) => row.user._id === donorUser._id.toString());
    assert.ok(entry);
    assert.equal(entry.profile.bloodGroup, donor.bloodGroup);
    assert.equal(entry.profile.city, donor.city);

    const unauthorized = await callApi(
      patchVerification,
      '/api/admin/verification',
      donorToken,
      'PATCH',
      { userId: donorUser._id.toString(), status: 'VERIFIED' }
    );
    assert.equal(unauthorized.status, 403);

    for (const status of ['VERIFIED', 'REJECTED'] as const) {
      const result = await callApi(
        patchVerification,
        '/api/admin/verification',
        token,
        'PATCH',
        { userId: donorUser._id.toString(), status }
      );
      assert.equal(result.status, 200);
      const [savedUser, savedVerification] = await Promise.all([
        User.findById(donorUser._id).select('verificationStatus'),
        Verification.findOne({ userId: donorUser._id }).select('status'),
      ]);
      assert.equal(savedUser?.verificationStatus, status);
      assert.equal(savedVerification?.status, status);
    }
  } finally {
    await cleanup();
  }
});

test('eligible donors receive idempotent matching notifications and ineligible donors do not', async (t) => {
  if (!(await requireDatabase(t))) return;
  try {
    const hospitalUser = await makeUser('HOSPITAL', 'notification-hospital');
    const hospital = await makeHospital(hospitalUser._id, 'notification-hospital');
    const eligibleUsers: InstanceType<typeof User>[] = [];
    for (let index = 0; index < 11; index++) {
      const user = await makeUser('DONOR', `eligible-${index}`);
      eligibleUsers.push(user);
      await makeDonor(user._id, `eligible-${index}`);
    }
    const ineligibleUser = await makeUser('DONOR', 'ineligible');
    await makeDonor(ineligibleUser._id, 'ineligible', 'B+');
    const request = await makeRequest(hospital, hospitalUser._id, 'notification-request');

    const matches = await runMatchingEngine(request._id.toString(), hospitalUser._id.toString());
    created.matchIds.push(...matches.map((match) => match._id));
    const donorMatches = matches.filter((match) => match.resourceType === 'DONOR');
    assert.equal(donorMatches.length, eligibleUsers.length);
    assert.equal(await Notification.countDocuments({ userId: ineligibleUser._id, type: 'NEW_MATCH', referenceType: 'MATCH' }), 0);
    assert.equal(
      await Notification.countDocuments({
        userId: { $in: eligibleUsers.map((user) => user._id) },
        type: 'NEW_MATCH',
        referenceType: 'MATCH',
      }),
      eligibleUsers.length
    );

    const donorToken = await makeToken(eligibleUsers[0]);
    const inbox = await callApi(getNotifications, '/api/notifications?limit=50', donorToken);
    assert.equal(inbox.status, 200);
    assert.ok((await inbox.json()).data.some((notification: { title: string }) => notification.title === 'Emergency Blood Request Match'));

    await Promise.all([
      backfillEligibleDonorMatchNotifications(10, [request._id.toString()]),
      backfillEligibleDonorMatchNotifications(10, [request._id.toString()]),
    ]);
    await backfillEligibleDonorMatchNotifications(10, [request._id.toString()]);
    assert.equal(
      await Notification.countDocuments({
        userId: { $in: eligibleUsers.map((user) => user._id) },
        type: 'NEW_MATCH',
        referenceType: 'MATCH',
      }),
      eligibleUsers.length
    );
  } finally {
    await cleanup();
  }
});

test('backfill only notifies eligible active requests and does not duplicate notifications', async (t) => {
  if (!(await requireDatabase(t))) return;
  try {
    const hospitalUser = await makeUser('HOSPITAL', 'backfill-hospital');
    const hospital = await makeHospital(hospitalUser._id, 'backfill-hospital');
    const donorUser = await makeUser('DONOR', 'backfill-donor');
    const donor = await makeDonor(donorUser._id, 'backfill-donor');
    const active = await makeRequest(hospital, hospitalUser._id, 'backfill-active', { status: 'RESOURCES_NOTIFIED' });
    const expired = await makeRequest(hospital, hospitalUser._id, 'backfill-expired', {
      status: 'RESOURCES_NOTIFIED',
      requiredBy: new Date(Date.now() - 60_000),
    });
    const cancelled = await makeRequest(hospital, hospitalUser._id, 'backfill-cancelled', { status: 'CANCELLED' });
    await makeMatch(active, donorUser._id, donor._id, 'eligible-active');
    await makeMatch(expired, donorUser._id, donor._id, 'expired-request');
    await makeMatch(cancelled, donorUser._id, donor._id, 'cancelled-request');

    const first = await backfillEligibleDonorMatchNotifications(100, [active._id.toString(), expired._id.toString(), cancelled._id.toString()]);
    const second = await backfillEligibleDonorMatchNotifications(100, [active._id.toString(), expired._id.toString(), cancelled._id.toString()]);
    assert.equal(first.donorMatchesNotified, 1);
    assert.equal(second.donorMatchesNotified, 1);
    assert.equal(await Notification.countDocuments({ userId: donorUser._id, type: 'NEW_MATCH', referenceType: 'MATCH' }), 1);
    assert.equal(await Match.countDocuments({ emergencyRequestId: active._id, status: 'NOTIFIED' }), 1);
    assert.equal(await Match.countDocuments({ emergencyRequestId: expired._id, status: 'PENDING' }), 1);
    assert.equal(await Match.countDocuments({ emergencyRequestId: cancelled._id, status: 'PENDING' }), 1);
  } finally {
    await cleanup();
  }
});

test('admin inventory all and specific filters avoid invalid ObjectId casts', async (t) => {
  if (!(await requireDatabase(t))) return;
  try {
    const admin = await makeUser('ADMIN', 'inventory-admin');
    const bankUser1 = await makeUser('BLOOD_BANK', 'inventory-bank-one');
    const bankUser2 = await makeUser('BLOOD_BANK', 'inventory-bank-two');
    const bank1 = await makeBank(bankUser1._id, 'inventory-bank-one');
    const bank2 = await makeBank(bankUser2._id, 'inventory-bank-two');
    const firstInventory = await Inventory.create({
      bloodBankId: bank1._id, bloodGroup: 'A+', component: 'PRBC',
      availableUnits: 4, reservedUnits: 0, totalUnits: 4, lastUpdated: new Date(),
    });
    const secondInventory = await Inventory.create({
      bloodBankId: bank2._id, bloodGroup: 'O+', component: 'PRBC',
      availableUnits: 7, reservedUnits: 0, totalUnits: 7, lastUpdated: new Date(),
    });
    created.inventoryIds.push(firstInventory._id, secondInventory._id);
    const adminToken = await makeToken(admin);

    const all = await callApi(getInventoryRoute, '/api/inventory?bloodBankId=all', adminToken);
    assert.equal(all.status, 200);
    assert.ok((await all.json()).data.some((item: { _id: string }) => item._id === firstInventory._id.toString()));
    const specific = await callApi(getInventoryRoute, `/api/inventory?bloodBankId=${bank2._id}`, adminToken);
    assert.equal(specific.status, 200);
    assert.deepEqual((await specific.json()).data.map((item: { _id: string }) => item._id), [secondInventory._id.toString()]);
    const invalid = await callApi(getInventoryRoute, '/api/inventory?bloodBankId=not-an-object-id', adminToken);
    assert.equal(invalid.status, 400);
  } finally {
    await cleanup();
  }
});

test('donor availability survives API reloads and reservation release preserves later choices', async (t) => {
  if (!(await requireDatabase(t))) return;
  try {
    const donorUser = await makeUser('DONOR', 'availability-donor');
    const hospitalUser = await makeUser('HOSPITAL', 'availability-hospital');
    const hospital = await makeHospital(hospitalUser._id, 'availability-hospital');
    const donor = await makeDonor(donorUser._id, 'availability-donor');
    const donorToken = await makeToken(donorUser);

    for (const status of ['AVAILABLE', 'UNAVAILABLE', 'TEMPORARILY_UNAVAILABLE'] as const) {
      const save = await callApi(
        patchAvailability,
        '/api/donor/availability',
        donorToken,
        'PATCH',
        { availabilityStatus: status }
      );
      assert.equal(save.status, 200);
      const reload = await callApi(getAvailability, '/api/donor/availability', donorToken);
      assert.equal(reload.status, 200);
      assert.equal((await reload.json()).data.availabilityStatus, status);
    }

    await callApi(
      patchAvailability,
      '/api/donor/availability',
      donorToken,
      'PATCH',
      { availabilityStatus: 'AVAILABLE' }
    );
    const request = await makeRequest(hospital, hospitalUser._id, 'availability-reservation');
    const match = await makeMatch(request, donorUser._id, donor._id, 'availability-reservation', 'DONOR', 'ACCEPTED');
    const reservation = await reserveAcceptedMatch(match._id.toString(), { userId: donorUser._id.toString(), userName: donorUser.name });
    assert.equal((await Donor.findById(donor._id))?.availabilityStatus, 'TEMPORARILY_UNAVAILABLE');

    const userChoice = await callApi(
      patchAvailability,
      '/api/donor/availability',
      donorToken,
      'PATCH',
      { availabilityStatus: 'UNAVAILABLE' }
    );
    assert.equal(userChoice.status, 200);
    await releaseMatchReservation(match._id.toString(), 'TEST_RELEASE', { userId: donorUser._id.toString(), userName: donorUser.name });
    assert.equal((await Donor.findById(donor._id))?.availabilityStatus, 'UNAVAILABLE');
    assert.equal((await Reservation.findById(reservation._id))?.status, 'RELEASED');
  } finally {
    await cleanup();
  }
});

after(async () => {
  await cleanup();
  await mongoose.disconnect().catch(() => undefined);
});
