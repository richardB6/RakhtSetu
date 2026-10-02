import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import fs from 'node:fs';
import mongoose from 'mongoose';
import { User } from '../src/models/User.ts';
import { Hospital } from '../src/models/Hospital.ts';
import { BloodBank } from '../src/models/BloodBank.ts';
import { Inventory } from '../src/models/Inventory.ts';
import { EmergencyRequest } from '../src/models/EmergencyRequest.ts';
import { Match } from '../src/models/Match.ts';
import { Reservation } from '../src/models/Reservation.ts';
import { Notification } from '../src/models/Notification.ts';

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const separator = line.indexOf('=');
  if (separator > 0 && !line.startsWith('#')) {
    const key = line.slice(0, separator);
    if (!process.env[key]) process.env[key] = line.slice(separator + 1);
  }
}

let connectToDatabase: typeof import('../src/lib/db/mongodb.ts').connectToDatabase;
let respondToMatch: typeof import('../src/lib/services/matching.service.ts').respondToMatch;
let signAccessToken: typeof import('../src/lib/auth/jwt.ts').signAccessToken;
let listEmergencies: typeof import('../src/app/api/emergencies/route.ts').GET;
let updateEmergency: typeof import('../src/app/api/emergencies/[id]/route.ts').PATCH;
let updateEmergencyStatus: typeof import('../src/app/api/emergencies/[id]/status/route.ts').PATCH;
let confirmReceipt: typeof import('../src/app/api/emergencies/[id]/receipt/route.ts').POST;
let getAnalytics: typeof import('../src/app/api/analytics/route.ts').GET;
let getCommandCenter: typeof import('../src/app/api/command-center/route.ts').GET;
let cookieName: typeof import('../src/lib/auth/cookies.ts').COOKIE_NAMES.ACCESS_TOKEN;
let servicesLoaded = false;

async function loadServices() {
  if (servicesLoaded) return;
  ({ connectToDatabase } = await import('../src/lib/db/mongodb.ts'));
  ({ respondToMatch } = await import('../src/lib/services/matching.service.ts'));
  ({ signAccessToken } = await import('../src/lib/auth/jwt.ts'));
  ({ GET: listEmergencies } = await import('../src/app/api/emergencies/route.ts'));
  ({ PATCH: updateEmergency } = await import('../src/app/api/emergencies/[id]/route.ts'));
  ({ PATCH: updateEmergencyStatus } = await import('../src/app/api/emergencies/[id]/status/route.ts'));
  ({ POST: confirmReceipt } = await import('../src/app/api/emergencies/[id]/receipt/route.ts'));
  ({ GET: getAnalytics } = await import('../src/app/api/analytics/route.ts'));
  ({ GET: getCommandCenter } = await import('../src/app/api/command-center/route.ts'));
  ({ COOKIE_NAMES: { ACCESS_TOKEN: cookieName } } = await import('../src/lib/auth/cookies.ts'));
  servicesLoaded = true;
}

const prefix = `delivery-test-${Date.now()}`;
const createdIds = {
  users: [] as mongoose.Types.ObjectId[],
  hospitals: [] as mongoose.Types.ObjectId[],
  banks: [] as mongoose.Types.ObjectId[],
  inventory: [] as mongoose.Types.ObjectId[],
  requests: [] as mongoose.Types.ObjectId[],
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

async function makeUser(role: 'HOSPITAL' | 'BLOOD_BANK', suffix: string) {
  const user = await User.create({
    email: `${prefix}-${suffix}@example.invalid`,
    password: 'integration-test-password',
    name: `${prefix} ${suffix}`,
    phone: '9999999999',
    role,
    verificationStatus: 'VERIFIED',
  });
  createdIds.users.push(user._id);
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
    location: { type: 'Point', coordinates: [72.8777, 19.076] },
    contactPerson: 'Test Contact',
    contactPhone: '9999999999',
    contactEmail: `${prefix}-${suffix}@example.invalid`,
    operatingHours: '24/7',
  });
  createdIds.hospitals.push(hospital._id);
  return hospital;
}

async function createRequest(hospital: InstanceType<typeof Hospital>, userId: mongoose.Types.ObjectId, suffix: string, status: 'CREATED' | 'RESOURCES_NOTIFIED') {
  const request = await EmergencyRequest.create({
    requestId: `${prefix}-${suffix}`,
    hospitalId: hospital._id,
    createdBy: userId,
    patientReference: `${prefix}-patient-${suffix}`,
    bloodGroup: 'A+',
    component: 'PRBC',
    quantity: 3,
    quantityFulfilled: 0,
    severity: 'HIGH',
    requiredBy: new Date(Date.now() + 60 * 60 * 1000),
    location: hospital.location,
    address: hospital.address,
    city: hospital.city,
    status,
    contactPerson: hospital.contactPerson,
    contactPhone: hospital.contactPhone,
    searchRadiusKm: 10,
    matchCount: 1,
    responseCount: 0,
    responseTimeoutMinutes: 15,
    escalationLevel: 0,
  });
  createdIds.requests.push(request._id);
  return request;
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

async function callApi<T extends (request: import('next/server').NextRequest, context: { params: Promise<Record<string, string>> }) => Promise<Response>>(
  handler: T,
  path: string,
  token: string,
  method = 'GET',
  params: Record<string, string> = {},
  body?: unknown
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
  await Notification.deleteMany({ userId: { $in: createdIds.users } });
  await Notification.deleteMany({ referenceId: { $in: createdIds.requests } });
  await Reservation.deleteMany({ emergencyRequestId: { $in: createdIds.requests } });
  await Match.deleteMany({ emergencyRequestId: { $in: createdIds.requests } });
  await EmergencyRequest.deleteMany({ _id: { $in: createdIds.requests } });
  await Inventory.deleteMany({ _id: { $in: createdIds.inventory } });
  await BloodBank.deleteMany({ _id: { $in: createdIds.banks } });
  await Hospital.deleteMany({ _id: { $in: createdIds.hospitals } });
  await User.deleteMany({ _id: { $in: createdIds.users } });
}

test('hospital confirms accepted blood-bank delivery exactly once', async (t) => {
  if (!(await requireDatabase(t))) return;
  try {
    const hospitalUser = await makeUser('HOSPITAL', 'hospital-user');
    const otherHospitalUser = await makeUser('HOSPITAL', 'other-hospital-user');
    const bankUser = await makeUser('BLOOD_BANK', 'bank-user');
    const hospital = await makeHospital(hospitalUser._id, 'Hospital');
    await makeHospital(otherHospitalUser._id, 'Other Hospital');
    const bank = await BloodBank.create({
      userId: bankUser._id,
      name: `${prefix} Blood Bank`,
      licenseNumber: `${prefix}-license`,
      type: 'STANDALONE',
      address: 'Integration Test Address',
      city: 'Test City',
      state: 'Test State',
      pincode: '400001',
      location: { type: 'Point', coordinates: [72.8777, 19.076] },
      contactPerson: 'Test Contact',
      contactPhone: '9999999999',
      contactEmail: `${prefix}-bank@example.invalid`,
      operatingHours: '24/7',
      operationalStatus: 'OPEN',
      componentCapabilities: ['PRBC'],
    });
    createdIds.banks.push(bank._id);
    const inventory = await Inventory.create({
      bloodBankId: bank._id,
      bloodGroup: 'A+',
      component: 'PRBC',
      availableUnits: 6,
      reservedUnits: 0,
      totalUnits: 6,
      lastUpdated: new Date(),
    });
    createdIds.inventory.push(inventory._id);

    const emergency = await createRequest(hospital, hospitalUser._id, 'accepted', 'RESOURCES_NOTIFIED');
    await Match.create({
      emergencyRequestId: emergency._id,
      resourceType: 'BLOOD_BANK',
      resourceId: bank._id,
      resourceUserId: bankUser._id,
      score: 90,
      rank: 1,
      factors: { compatibilityScore: 100, availabilityScore: 100, distanceScore: 100, verificationScore: 100, responseReliabilityScore: 60, urgencyScore: 70 },
      compatibilityType: 'EXACT',
      distanceKm: 1,
      availableQuantity: 6,
      isVerified: true,
      reasons: ['integration test'],
      status: 'NOTIFIED',
    });

    await respondToMatch(
      (await Match.findOne({ emergencyRequestId: emergency._id }))!._id.toString(),
      bankUser._id.toString(),
      true
    );

    const afterAcceptance = await Inventory.findById(inventory._id);
    assert.equal(afterAcceptance?.availableUnits, 3);
    assert.equal(afterAcceptance?.reservedUnits, 3);
    assert.equal(afterAcceptance?.totalUnits, 6);

    const hospitalToken = await makeToken(hospitalUser);
    const otherHospitalToken = await makeToken(otherHospitalUser);
    const trackerResponse = await callApi(
      listEmergencies,
      '/api/emergencies?limit=100&includeMatches=true',
      hospitalToken
    );
    assert.equal(trackerResponse.status, 200);
    const tracker = await trackerResponse.json();
    const trackedRequest = tracker.data.find((request: { _id: string }) => request._id === emergency._id.toString());
    assert.ok(trackedRequest, JSON.stringify(tracker));
    assert.equal(trackedRequest.bloodGroup, 'A+');
    assert.equal(trackedRequest.component, 'PRBC');
    assert.equal(trackedRequest.quantity, 3);
    assert.equal(trackedRequest.matchedBloodBanks[0].name, bank.name);
    assert.equal(trackedRequest.status, 'RESPONSES_RECEIVED');

    const receiptParams = { id: emergency._id.toString() };
    const unauthorizedResponse = await callApi(
      confirmReceipt,
      `/api/emergencies/${emergency._id}/receipt`,
      otherHospitalToken,
      'POST',
      receiptParams
    );
    assert.equal(unauthorizedResponse.status, 403);

    const invalidStatusRequest = await createRequest(hospital, hospitalUser._id, 'invalid-status', 'CREATED');
    const invalidStatusResponse = await callApi(
      confirmReceipt,
      `/api/emergencies/${invalidStatusRequest._id}/receipt`,
      hospitalToken,
      'POST',
      { id: invalidStatusRequest._id.toString() }
    );
    assert.equal(invalidStatusResponse.status, 409);

    const directFulfillmentResponse = await callApi(
      updateEmergency,
      `/api/emergencies/${emergency._id}`,
      hospitalToken,
      'PATCH',
      receiptParams,
      { status: 'FULFILLED' }
    );
    assert.equal(directFulfillmentResponse.status, 409);
    const directWorkflowResponse = await callApi(
      updateEmergencyStatus,
      `/api/emergencies/${emergency._id}/status`,
      hospitalToken,
      'PATCH',
      receiptParams,
      { status: 'FULFILLED' }
    );
    assert.equal(directWorkflowResponse.status, 409);

    await EmergencyRequest.updateOne({ _id: emergency._id }, { $set: { status: 'CANCELLED' } });
    const cancelledResponse = await callApi(
      confirmReceipt,
      `/api/emergencies/${emergency._id}/receipt`,
      hospitalToken,
      'POST',
      receiptParams
    );
    assert.equal(cancelledResponse.status, 409);
    await EmergencyRequest.updateOne({ _id: emergency._id }, { $set: { status: 'RESPONSES_RECEIVED' } });

    const receiptResponses = await Promise.all([
      callApi(confirmReceipt, `/api/emergencies/${emergency._id}/receipt`, hospitalToken, 'POST', receiptParams),
      callApi(confirmReceipt, `/api/emergencies/${emergency._id}/receipt`, hospitalToken, 'POST', receiptParams),
    ]);
    assert.deepEqual(receiptResponses.map((response) => response.status), [200, 200]);
    const receiptResults = await Promise.all(receiptResponses.map((response) => response.json()));
    assert.ok(receiptResults.every((response) => response.data.status === 'FULFILLED'));
    assert.equal(receiptResults.filter((response) => !response.data.alreadyReceived).length, 1);

    const fulfilledRequest = await EmergencyRequest.findById(emergency._id);
    const fulfilledMatch = await Match.findOne({ emergencyRequestId: emergency._id });
    const fulfilledReservation = await Reservation.findOne({ emergencyRequestId: emergency._id });
    const afterReceipt = await Inventory.findById(inventory._id);
    assert.equal(fulfilledRequest?.status, 'FULFILLED');
    assert.equal(fulfilledMatch?.status, 'FULFILLED');
    assert.equal(fulfilledReservation?.status, 'FULFILLED');
    assert.equal(afterReceipt?.availableUnits, 3);
    assert.equal(afterReceipt?.reservedUnits, 0);
    assert.equal(afterReceipt?.totalUnits, 3);

    const duplicateResponse = await callApi(
      confirmReceipt,
      `/api/emergencies/${emergency._id}/receipt`,
      hospitalToken,
      'POST',
      receiptParams
    );
    assert.equal(duplicateResponse.status, 200);
    assert.equal(
      await Notification.countDocuments({
        userId: bankUser._id,
        type: 'FULFILLMENT_UPDATE',
        referenceType: 'EMERGENCY_RECEIPT',
        referenceId: emergency._id,
      }),
      1
    );
    assert.equal(
      await Notification.countDocuments({
        userId: hospitalUser._id,
        referenceType: 'EMERGENCY_RECEIPT',
        referenceId: emergency._id,
      }),
      0
    );
    const bankNotification = await Notification.findOne({
      userId: bankUser._id,
      type: 'FULFILLMENT_UPDATE',
      referenceType: 'EMERGENCY_RECEIPT',
      referenceId: emergency._id,
    });
    assert.ok(bankNotification);
    assert.match(bankNotification.message, /confirmed receipt/i);
    assert.ok(bankNotification.message.includes(hospital.name));
    assert.ok(bankNotification.message.includes(emergency.requestId));
    const inventoryAfterDuplicates = await Inventory.findById(inventory._id);
    assert.equal(inventoryAfterDuplicates?.availableUnits, 3);
    assert.equal(inventoryAfterDuplicates?.reservedUnits, 0);
    assert.equal(inventoryAfterDuplicates?.totalUnits, 3);

    const analyticsResponse = await callApi(getAnalytics, '/api/analytics?days=30', hospitalToken);
    const dashboardResponse = await callApi(getCommandCenter, '/api/command-center?days=30', hospitalToken);
    assert.equal(analyticsResponse.status, 200);
    assert.equal(dashboardResponse.status, 200);
    const analytics = await analyticsResponse.json();
    const dashboard = await dashboardResponse.json();
    assert.equal(analytics.data.stats.totalFulfilled, dashboard.data.stats.totalFulfilled);
    assert.equal(dashboard.data.roleDashboard.fulfilledRequests, analytics.data.stats.totalFulfilled);
    assert.ok(analytics.data.stats.totalFulfilled >= 1);
  } finally {
    await cleanup();
  }
});

after(async () => {
  await cleanup();
  await mongoose.disconnect().catch(() => undefined);
});
