import assert from 'node:assert/strict';
import { test } from 'node:test';
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
import { AuditLog } from '../src/models/AuditLog.ts';

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const separator = line.indexOf('=');
  if (separator > 0 && !line.startsWith('#')) {
    const key = line.slice(0, separator);
    if (!process.env[key]) process.env[key] = line.slice(separator + 1);
  }
}

let connectToDatabase: typeof import('../src/lib/db/mongodb.ts').connectToDatabase;
let respondToMatch: typeof import('../src/lib/services/matching.service.ts').respondToMatch;
let runMatchingEngine: typeof import('../src/lib/services/matching.service.ts').runMatchingEngine;
let createEmergencyRequest: typeof import('../src/lib/services/emergency.service.ts').createEmergencyRequest;
let signAccessToken: typeof import('../src/lib/auth/jwt.ts').signAccessToken;
let getIncomingMatches: typeof import('../src/app/api/matches/route.ts').GET;
let releaseRequestReservations: typeof import('../src/lib/services/reservation.service.ts').releaseRequestReservations;
let reserveAcceptedMatch: typeof import('../src/lib/services/reservation.service.ts').reserveAcceptedMatch;
let servicesLoaded = false;

async function loadServices() {
  if (servicesLoaded) return;
  ({ connectToDatabase } = await import('../src/lib/db/mongodb.ts'));
  ({ respondToMatch } = await import('../src/lib/services/matching.service.ts'));
  ({ runMatchingEngine } = await import('../src/lib/services/matching.service.ts'));
  ({ createEmergencyRequest } = await import('../src/lib/services/emergency.service.ts'));
  ({ signAccessToken } = await import('../src/lib/auth/jwt.ts'));
  ({ GET: getIncomingMatches } = await import('../src/app/api/matches/route.ts'));
  ({ releaseRequestReservations, reserveAcceptedMatch } = await import('../src/lib/services/reservation.service.ts'));
  servicesLoaded = true;
}

const prefix = `phase6-test-${Date.now()}`;
const createdIds = {
  users: [] as mongoose.Types.ObjectId[],
  hospitals: [] as mongoose.Types.ObjectId[],
  banks: [] as mongoose.Types.ObjectId[],
  inventory: [] as mongoose.Types.ObjectId[],
  requests: [] as mongoose.Types.ObjectId[],
  matches: [] as mongoose.Types.ObjectId[],
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

async function createFixture(quantity: number, requestSuffix: string) {
  const user = await User.create({
    email: `${prefix}-${requestSuffix}@example.invalid`,
    password: 'integration-test-password',
    name: `${prefix} Resource`,
    phone: '9999999999',
    role: 'BLOOD_BANK',
    verificationStatus: 'VERIFIED',
  });
  createdIds.users.push(user._id);

  const hospital = await Hospital.create({
    userId: user._id,
    name: `${prefix} Hospital ${requestSuffix}`,
    registrationNumber: `${prefix}-${requestSuffix}`,
    type: 'PRIVATE',
    address: 'Integration Test Address',
    city: 'Test City',
    state: 'Test State',
    pincode: '400001',
    location: { type: 'Point', coordinates: [72.8777, 19.076] },
    contactPerson: 'Test Contact',
    contactPhone: '9999999999',
    contactEmail: `${prefix}-${requestSuffix}-hospital@example.invalid`,
    operatingHours: '24/7',
  });
  createdIds.hospitals.push(hospital._id);

  const bank = await BloodBank.create({
    userId: user._id,
    name: `${prefix} Blood Bank ${requestSuffix}`,
    licenseNumber: `${prefix}-license-${requestSuffix}`,
    type: 'STANDALONE',
    address: 'Integration Test Address',
    city: 'Test City',
    state: 'Test State',
    pincode: '400001',
    location: { type: 'Point', coordinates: [72.8777, 19.076] },
    contactPerson: 'Test Contact',
    contactPhone: '9999999999',
    contactEmail: `${prefix}-${requestSuffix}-bank@example.invalid`,
    operatingHours: '24/7',
    operationalStatus: 'OPEN',
    componentCapabilities: ['PRBC'],
  });
  createdIds.banks.push(bank._id);

  const inventory = await Inventory.create({
    bloodBankId: bank._id,
    bloodGroup: 'A+',
    component: 'PRBC',
    availableUnits: quantity,
    reservedUnits: 0,
    totalUnits: quantity,
    lastUpdated: new Date(),
  });
  createdIds.inventory.push(inventory._id);

  const request = await EmergencyRequest.create({
    requestId: `${prefix}-${requestSuffix}`,
    hospitalId: hospital._id,
    createdBy: user._id,
    patientReference: `${prefix}-patient-${requestSuffix}`,
    bloodGroup: 'A+',
    component: 'PRBC',
    quantity: 4,
    quantityFulfilled: 0,
    severity: 'HIGH',
    requiredBy: new Date(Date.now() + 60 * 60 * 1000),
    location: { type: 'Point', coordinates: [72.8777, 19.076] },
    address: 'Integration Test Address',
    city: 'Test City',
    status: 'RESOURCES_NOTIFIED',
    contactPerson: 'Test Contact',
    contactPhone: '9999999999',
    searchRadiusKm: 10,
    matchCount: 1,
    responseCount: 0,
    responseTimeoutMinutes: 15,
    escalationLevel: 0,
  });
  createdIds.requests.push(request._id);

  const match = await Match.create({
    emergencyRequestId: request._id,
    resourceType: 'BLOOD_BANK',
    resourceId: bank._id,
    resourceUserId: user._id,
    score: 90,
    rank: 1,
    factors: { compatibilityScore: 100, availabilityScore: 100, distanceScore: 100, verificationScore: 100, responseReliabilityScore: 60, urgencyScore: 70 },
    compatibilityType: 'EXACT',
    distanceKm: 1,
    availableQuantity: quantity,
    isVerified: true,
    reasons: ['integration test'],
    status: 'NOTIFIED',
  });
  createdIds.matches.push(match._id);

  return { user, request, match, inventory, bank };
}

async function cleanup() {
  if (mongoose.connection.readyState !== 1) return;
  const matchIds = await Match.find({ emergencyRequestId: { $in: createdIds.requests } }).distinct('_id');
  await Notification.deleteMany({ referenceId: { $in: matchIds } });
  await Notification.deleteMany({ userId: { $in: createdIds.users } });
  await AuditLog.deleteMany({ description: { $regex: prefix } });
  await Reservation.deleteMany({ emergencyRequestId: { $in: createdIds.requests } });
  await Match.deleteMany({ emergencyRequestId: { $in: createdIds.requests } });
  await Match.deleteMany({ _id: { $in: createdIds.matches } });
  await EmergencyRequest.deleteMany({ _id: { $in: createdIds.requests } });
  await Inventory.deleteMany({ _id: { $in: createdIds.inventory } });
  await BloodBank.deleteMany({ _id: { $in: createdIds.banks } });
  await Hospital.deleteMany({ _id: { $in: createdIds.hospitals } });
  await User.deleteMany({ _id: { $in: createdIds.users } });
}

test('Belagavi hospital request routes once to eligible bank and persists responses', async (t) => {
  if (!(await requireDatabase(t))) return;
  try {
    const hospitalUser = await User.create({
      email: `${prefix}-belagavi-hospital@example.invalid`, password: 'integration-test-password',
      name: `${prefix} Belagavi Hospital`, phone: '9999999999', role: 'HOSPITAL', verificationStatus: 'VERIFIED',
    });
    createdIds.users.push(hospitalUser._id);
    const bankUser = await User.create({
      email: `${prefix}-belagavi-bank@example.invalid`, password: 'integration-test-password',
      name: `${prefix} Belagavi Bank`, phone: '9999999998', role: 'BLOOD_BANK', verificationStatus: 'VERIFIED',
    });
    createdIds.users.push(bankUser._id);
    const hospital = await Hospital.create({
      userId: hospitalUser._id, name: `${prefix} Belagavi Hospital`, registrationNumber: `${prefix}-belagavi`,
      type: 'PRIVATE', address: 'Belagavi test address', city: 'Belagavi', state: 'Karnataka', pincode: '590001',
      location: { type: 'Point', coordinates: [74.4977, 15.8497] }, contactPerson: 'Test Contact',
      contactPhone: '9999999999', contactEmail: `${prefix}-belagavi-hospital@example.invalid`, operatingHours: '24/7',
    });
    createdIds.hospitals.push(hospital._id);
    const bank = await BloodBank.create({
      userId: bankUser._id, name: `${prefix} Belagavi Bank`, licenseNumber: `${prefix}-belagavi-license`,
      type: 'STANDALONE', address: 'Belagavi bank address', city: 'Belagavi', state: 'Karnataka', pincode: '590001',
      location: { type: 'Point', coordinates: [74.501, 15.852] }, contactPerson: 'Test Contact',
      contactPhone: '9999999998', contactEmail: `${prefix}-belagavi-bank@example.invalid`, operatingHours: '24/7',
      operationalStatus: 'OPEN', componentCapabilities: ['PRBC'],
    });
    createdIds.banks.push(bank._id);
    for (const bloodGroup of ['A+', 'O-'] as const) {
      const inventory = await Inventory.create({
        bloodBankId: bank._id, bloodGroup, component: 'PRBC', availableUnits: 5, reservedUnits: 0,
        totalUnits: 5, lastUpdated: new Date(),
      });
      createdIds.inventory.push(inventory._id);
    }

    const input = {
      patientReference: `${prefix}-belagavi-patient`, bloodGroup: 'A+' as const, component: 'PRBC' as const,
      quantity: 4, severity: 'HIGH' as const, requiredBy: new Date(Date.now() + 60 * 60 * 1000),
      contactPerson: 'Test Contact', contactPhone: '9999999999',
    };
    const submissionKey = `${prefix}-submission-key`;
    const first = await createEmergencyRequest(input, hospital._id.toString(), hospitalUser._id.toString(), submissionKey);
    const duplicate = await createEmergencyRequest(input, hospital._id.toString(), hospitalUser._id.toString(), submissionKey);
    assert.equal(first.created, true);
    assert.equal(duplicate.created, false);
    assert.equal(duplicate.request._id.toString(), first.request._id.toString());
    createdIds.requests.push(first.request._id);

    first.request.status = 'MATCHING';
    first.request.matchingStartedAt = new Date(Date.now() - 120_000);
    first.request.matchCount = 0;
    await first.request.save();

    const token = await signAccessToken({
      userId: bankUser._id.toString(),
      email: bankUser.email,
      role: 'BLOOD_BANK',
      name: bankUser.name,
      verificationStatus: 'VERIFIED',
    });
    const { NextRequest } = await import('next/server');
    const requestMatches = async (query: string) => {
      const request = new NextRequest(`http://localhost/api/matches${query}`, {
        headers: { cookie: `rs_access_token=${token}` },
      });
      const response = await getIncomingMatches(request, { params: Promise.resolve({}) });
      assert.equal(response.status, 200);
      return response.json();
    };
    const actionable = await requestMatches('?status=NOTIFIED,PENDING&limit=50');
    const all = await requestMatches('?limit=50');
    const routedRequest = await EmergencyRequest.findById(first.request._id);
    assert.equal(routedRequest?.city, 'Belagavi');
    assert.equal(routedRequest?.status, 'RESOURCES_NOTIFIED');
    const bankMatches = await Match.find({ emergencyRequestId: first.request._id, resourceUserId: bankUser._id });
    assert.equal(bankMatches.length, 1);
    assert.ok(['PENDING', 'NOTIFIED'].includes(bankMatches[0].status));
    assert.ok(actionable.data.some((match: { _id: string }) => match._id === bankMatches[0]._id.toString()));
    assert.ok(all.data.some((match: { _id: string }) => match._id === bankMatches[0]._id.toString()));
    assert.equal(actionable.data.find((match: { _id: string }) => match._id === bankMatches[0]._id.toString()).emergencyRequestId.city, 'Belagavi');

    await respondToMatch(bankMatches[0]._id.toString(), bankUser._id.toString(), true);
    const hospitalView = await EmergencyRequest.findById(first.request._id);
    const bankView = await Match.findById(bankMatches[0]._id);
    assert.equal(hospitalView?.status, 'RESPONSES_RECEIVED');
    assert.equal(bankView?.status, 'RESERVED');
    createdIds.matches.push(...bankMatches.map((match) => match._id));

    const noStockRequest = await createEmergencyRequest({ ...input, component: 'FFP' }, hospital._id.toString(), hospitalUser._id.toString(), `${prefix}-no-recipient`);
    createdIds.requests.push(noStockRequest.request._id);
    await runMatchingEngine(noStockRequest.request._id.toString(), hospitalUser._id.toString());
    const escalatedRequest = await EmergencyRequest.findById(noStockRequest.request._id);
    assert.equal(escalatedRequest?.status, 'ESCALATED');
    assert.match(escalatedRequest?.matchingMessage ?? '', /No eligible blood bank or donor/);
  } finally {
    await cleanup();
  }
});

test('MongoDB workflow creates, reserves, and releases inventory for an accepted match', async (t) => {
  if (!(await requireDatabase(t))) return;
  try {
    const fixture = await createFixture(5, 'workflow');
    await respondToMatch(fixture.match._id.toString(), fixture.user._id.toString(), true);
    const reserved = await Inventory.findById(fixture.inventory._id);
    assert.equal(reserved?.availableUnits, 1);
    assert.equal(reserved?.reservedUnits, 4);
    assert.equal(reserved?.totalUnits, 5);
    assert.equal(await Reservation.countDocuments({ emergencyRequestId: fixture.request._id, status: 'ACTIVE' }), 1);

    await releaseRequestReservations(fixture.request._id.toString(), 'CANCELLED', {
      userId: fixture.user._id.toString(),
      userName: fixture.user.name,
    });
    const released = await Inventory.findById(fixture.inventory._id);
    assert.equal(released?.availableUnits, 5);
    assert.equal(released?.reservedUnits, 0);
    assert.equal(released?.totalUnits, 5);
  } finally {
    await cleanup();
  }
});

test('MongoDB atomic reservations allow only valid concurrent reservations', async (t) => {
  if (!(await requireDatabase(t))) return;
  try {
    const first = await createFixture(5, 'concurrency-a');
    const second = await createFixture(5, 'concurrency-b');
    await Inventory.updateOne({ _id: first.inventory._id }, { $set: { availableUnits: 5, reservedUnits: 0, totalUnits: 5 } });
    await Inventory.deleteOne({ _id: second.inventory._id });
    second.inventory = first.inventory;
    second.match.resourceId = first.bank._id;
    second.match.resourceUserId = first.user._id;
    first.match.status = 'ACCEPTED';
    second.match.status = 'ACCEPTED';
    await first.match.save();
    await second.match.save();
    const results = await Promise.allSettled([
      reserveAcceptedMatch(first.match._id.toString(), { userId: first.user._id.toString(), userName: first.user.name }),
      reserveAcceptedMatch(second.match._id.toString(), { userId: first.user._id.toString(), userName: first.user.name }),
    ]);
    const succeeded = results.filter((result) => result.status === 'fulfilled');
    assert.equal(succeeded.length, 1);
    const finalInventory = await Inventory.findById(first.inventory._id);
    assert.ok(finalInventory);
    assert.ok(finalInventory.availableUnits >= 0);
    assert.ok(finalInventory.reservedUnits >= 0);
    assert.ok(finalInventory.reservedUnits <= finalInventory.totalUnits);
    assert.equal(finalInventory.availableUnits + finalInventory.reservedUnits, finalInventory.totalUnits);
  } finally {
    await cleanup();
  }
});

test.after(async () => {
  await cleanup();
  await mongoose.disconnect().catch(() => undefined);
});
