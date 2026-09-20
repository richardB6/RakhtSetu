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

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const separator = line.indexOf('=');
  if (separator > 0 && !line.startsWith('#')) {
    const key = line.slice(0, separator);
    if (!process.env[key]) process.env[key] = line.slice(separator + 1);
  }
}

let connectToDatabase: typeof import('../src/lib/db/mongodb.ts').connectToDatabase;
let respondToMatch: typeof import('../src/lib/services/matching.service.ts').respondToMatch;
let releaseRequestReservations: typeof import('../src/lib/services/reservation.service.ts').releaseRequestReservations;
let reserveAcceptedMatch: typeof import('../src/lib/services/reservation.service.ts').reserveAcceptedMatch;
let servicesLoaded = false;

async function loadServices() {
  if (servicesLoaded) return;
  ({ connectToDatabase } = await import('../src/lib/db/mongodb.ts'));
  ({ respondToMatch } = await import('../src/lib/services/matching.service.ts'));
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
  await Reservation.deleteMany({ emergencyRequestId: { $in: createdIds.requests } });
  await Match.deleteMany({ _id: { $in: createdIds.matches } });
  await EmergencyRequest.deleteMany({ _id: { $in: createdIds.requests } });
  await Inventory.deleteMany({ _id: { $in: createdIds.inventory } });
  await BloodBank.deleteMany({ _id: { $in: createdIds.banks } });
  await Hospital.deleteMany({ _id: { $in: createdIds.hospitals } });
  await User.deleteMany({ _id: { $in: createdIds.users } });
}

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
