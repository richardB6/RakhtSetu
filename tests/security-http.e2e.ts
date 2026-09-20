import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { hashPassword } from '../src/lib/auth/password.ts';
import { User } from '../src/models/User.ts';
import { Hospital } from '../src/models/Hospital.ts';
import { BloodBank } from '../src/models/BloodBank.ts';
import { Donor } from '../src/models/Donor.ts';
import { EmergencyRequest } from '../src/models/EmergencyRequest.ts';
import { Inventory } from '../src/models/Inventory.ts';
import { Match } from '../src/models/Match.ts';
import { Reservation } from '../src/models/Reservation.ts';

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const separator = line.indexOf('=');
  if (separator > 0 && !line.startsWith('#') && !process.env[line.slice(0, separator)]) {
    process.env[line.slice(0, separator)] = line.slice(separator + 1);
  }
}

const prefix = `phase91-http-${Date.now()}`;
const password = 'SecurityE2E-password-123!';
const port = 3210 + Math.floor(Math.random() * 300);
const baseUrl = `http://127.0.0.1:${port}`;
let server: ChildProcess | undefined;
let databaseReady = false;

const users: Record<string, { id: mongoose.Types.ObjectId; email: string; cookie: string }> = {};
const profiles: mongoose.Types.ObjectId[] = [];
const emergencies: mongoose.Types.ObjectId[] = [];
const inventories: mongoose.Types.ObjectId[] = [];
const matches: mongoose.Types.ObjectId[] = [];

function jsonHeaders(cookie?: string) {
  return {
    'content-type': 'application/json',
    ...(cookie ? { cookie } : {}),
  };
}

async function api(path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, init);
}

async function login(email: string) {
  const response = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200, `login failed for ${email}`);
  const setCookie = response.headers.get('set-cookie') || '';
  const access = setCookie.match(/rs_access_token=[^;]+/)?.[0];
  assert.ok(access, 'login did not return an access cookie');
  return access;
}

async function createUser(role: 'DONOR' | 'HOSPITAL' | 'BLOOD_BANK' | 'ADMIN', suffix: string) {
  const user = await User.create({
    email: `${prefix}-${suffix}@example.invalid`,
    password: await hashPassword(password),
    name: `${prefix} ${suffix}`,
    phone: '9999999999',
    role,
    verificationStatus: 'VERIFIED',
  });
  users[suffix] = { id: user._id, email: user.email, cookie: '' };
  return user;
}

async function createHospital(user: mongoose.Types.ObjectId, suffix: string) {
  const hospital = await Hospital.create({
    userId: user,
    name: `${prefix} Hospital ${suffix}`,
    registrationNumber: `${prefix}-${suffix}`,
    type: 'PRIVATE',
    address: 'Security test address',
    city: 'Test City',
    state: 'Test State',
    pincode: '400001',
    location: { type: 'Point', coordinates: [72.8777, 19.076] },
    contactPerson: 'Security Test',
    contactPhone: '9999999999',
    contactEmail: `${prefix}-${suffix}@example.invalid`,
    operatingHours: '24/7',
  });
  profiles.push(hospital._id);
  return hospital;
}

async function createBloodBank(user: mongoose.Types.ObjectId) {
  const bank = await BloodBank.create({
    userId: user,
    name: `${prefix} Blood Bank`,
    licenseNumber: `${prefix}-license`,
    type: 'STANDALONE',
    address: 'Security test address',
    city: 'Test City',
    state: 'Test State',
    pincode: '400001',
    location: { type: 'Point', coordinates: [72.8777, 19.076] },
    contactPerson: 'Security Test',
    contactPhone: '9999999999',
    contactEmail: `${prefix}-bank@example.invalid`,
    operatingHours: '24/7',
    operationalStatus: 'OPEN',
    componentCapabilities: ['PRBC'],
  });
  profiles.push(bank._id);
  return bank;
}

async function createDonor(user: mongoose.Types.ObjectId) {
  const donor = await Donor.create({
    userId: user,
    bloodGroup: 'O+',
    address: 'Security test address',
    city: 'Test City',
    state: 'Test State',
    pincode: '400001',
    location: { type: 'Point', coordinates: [72.8777, 19.076] },
    availabilityStatus: 'AVAILABLE',
    isAvailable: true,
    emergencyNotificationsEnabled: true,
  });
  profiles.push(donor._id);
  return donor;
}

async function createEmergency(
  hospitalId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  suffix: string,
  bloodGroup: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' = 'A+'
) {
  const request = await EmergencyRequest.create({
    requestId: `${prefix}-${suffix}`,
    hospitalId,
    createdBy: userId,
    patientReference: `${prefix}-patient-${suffix}`,
    bloodGroup,
    component: 'PRBC',
    quantity: 1,
    quantityFulfilled: 0,
    severity: 'HIGH',
    requiredBy: new Date(Date.now() + 60 * 60 * 1000),
    location: { type: 'Point', coordinates: [72.8777, 19.076] },
    address: 'Security test address',
    city: 'Test City',
    status: 'RESOURCES_NOTIFIED',
    contactPerson: 'Security Test',
    contactPhone: '9999999999',
    searchRadiusKm: 10,
    matchCount: 0,
    responseCount: 0,
    responseTimeoutMinutes: 15,
    escalationLevel: 0,
  });
  emergencies.push(request._id);
  return request;
}

async function createAcceptedMatch(request: mongoose.Types.ObjectId, bank: mongoose.Types.ObjectId, bankUser: mongoose.Types.ObjectId, suffix: string) {
  const match = await Match.create({
    emergencyRequestId: request,
    resourceType: 'BLOOD_BANK',
    resourceId: bank,
    resourceUserId: bankUser,
    score: 90,
    rank: 1,
    factors: { compatibilityScore: 100, availabilityScore: 100, distanceScore: 100, verificationScore: 100, responseReliabilityScore: 60, urgencyScore: 70 },
    compatibilityType: 'EXACT',
    distanceKm: 1,
    availableQuantity: 1,
    isVerified: true,
    reasons: [`security-${suffix}`],
    status: 'ACCEPTED',
  });
  matches.push(match._id);
  return match;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', body: '{}' });
      if ([400, 401, 422].includes(response.status)) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Next server did not start in time');
}

before(async () => {
  const { connectToDatabase } = await import('../src/lib/db/mongodb.ts');
  await connectToDatabase();
  databaseReady = true;

  const admin = await createUser('ADMIN', 'admin');
  const donor = await createUser('DONOR', 'donor');
  const hospitalA = await createUser('HOSPITAL', 'hospital-a');
  const hospitalB = await createUser('HOSPITAL', 'hospital-b');
  const bloodBank = await createUser('BLOOD_BANK', 'blood-bank');
  await createHospital(hospitalA._id, 'A');
  const hospitalBProfile = await createHospital(hospitalB._id, 'B');
  await createDonor(donor._id);
  const bank = await createBloodBank(bloodBank._id);
  const requestB = await createEmergency(hospitalBProfile._id, hospitalB._id, 'private');
  const requestCompleted = await createEmergency(hospitalBProfile._id, hospitalB._id, 'completed');
  requestCompleted.status = 'FULFILLED';
  await requestCompleted.save();

  const inventory = await Inventory.create({
    bloodBankId: bank._id,
    bloodGroup: 'A+',
    component: 'PRBC',
    availableUnits: 1,
    reservedUnits: 0,
    totalUnits: 1,
    lastUpdated: new Date(),
  });
  inventories.push(inventory._id);
  const match = await createAcceptedMatch(requestB._id, bank._id, bloodBank._id, 'primary');

  void admin;
  void match;

  server = spawn(process.execPath, [
    path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next'),
    'dev',
    '--webpack',
    '--port',
    String(port),
  ], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'test', PORT: String(port) },
    stdio: 'ignore',
  });
  await waitForServer();
  for (const user of Object.values(users)) user.cookie = await login(user.email);
});

after(async () => {
  if (server?.pid) server.kill();
  if (!databaseReady) return;
  await Reservation.deleteMany({ emergencyRequestId: { $in: emergencies } });
  await Match.deleteMany({ _id: { $in: matches } });
  await EmergencyRequest.deleteMany({ _id: { $in: emergencies } });
  await Inventory.deleteMany({ _id: { $in: inventories } });
  await BloodBank.deleteMany({ _id: { $in: profiles } });
  await Hospital.deleteMany({ _id: { $in: profiles } });
  await Donor.deleteMany({ _id: { $in: profiles } });
  await User.deleteMany({ email: new RegExp(`^${prefix}-`) });
  await mongoose.disconnect();
});

test('1. unauthenticated access is rejected', async () => {
  const response = await api('/api/notifications');
  assert.equal(response.status, 401);
});

test('2. donor cannot access admin verification data', async () => {
  const response = await api('/api/admin/verification', { headers: jsonHeaders(users.donor.cookie) });
  assert.ok([403, 404].includes(response.status));
});

test('3. hospital cannot access another hospital emergency', async () => {
  const request = await EmergencyRequest.findOne({ requestId: `${prefix}-private` });
  assert.ok(request);
  const response = await api(`/api/emergencies/${request._id}`, { headers: jsonHeaders(users['hospital-a'].cookie) });
  assert.ok([403, 404].includes(response.status));
  assert.equal((await response.json()).data, undefined);
});

test('4. unauthorized inventory modification is rejected', async () => {
  const response = await api('/api/inventory', {
    method: 'PATCH',
    headers: jsonHeaders(users.donor.cookie),
    body: JSON.stringify({ bloodGroup: 'A+', component: 'PRBC', availableUnits: 99 }),
  });
  assert.equal(response.status, 403);
});

test('5. unauthorized reservation is rejected', async () => {
  const match = await Match.findOne({ _id: { $in: matches } });
  assert.ok(match);
  const response = await api('/api/inventory/reserve', {
    method: 'POST',
    headers: jsonHeaders(users.donor.cookie),
    body: JSON.stringify({ matchId: match._id.toString() }),
  });
  assert.equal(response.status, 403);
});

test('6. arbitrary notification creation is not exposed', async () => {
  const response = await api('/api/notifications', {
    method: 'POST',
    headers: jsonHeaders(users.donor.cookie),
    body: JSON.stringify({ userId: users.admin.id.toString(), message: 'unauthorized' }),
  });
  assert.equal(response.status, 405);
});

test('7. invalid emergency request is rejected', async () => {
  const response = await api('/api/emergencies', {
    method: 'POST',
    headers: jsonHeaders(users['hospital-a'].cookie),
    body: JSON.stringify({
      patientReference: 'invalid',
      bloodGroup: 'INVALID',
      component: 'PRBC',
      quantity: 0,
      severity: 'URGENT',
      requiredBy: 'not-a-date',
      contactPerson: 'x',
      contactPhone: '1',
    }),
  });
  assert.equal(response.status, 400);
});

test('8. incompatible blood resource is not matched', async () => {
  const bank = await BloodBank.findOne({ userId: users['blood-bank'].id });
  const hospital = await Hospital.findOne({ userId: users['hospital-a'].id });
  assert.ok(bank);
  assert.ok(hospital);
  const request = await createEmergency(hospital._id, users['hospital-a'].id, 'incompatible', 'O-');
  const match = await createAcceptedMatch(request._id, bank._id, users['blood-bank'].id, 'incompatible');
  const matching = await api('/api/inventory/reserve', {
    method: 'POST',
    headers: jsonHeaders(users['blood-bank'].cookie),
    body: JSON.stringify({ matchId: match._id.toString() }),
  });
  const matchingPayload = await matching.json();
  assert.equal(matching.status, 409, JSON.stringify(matchingPayload));
  assert.match(matchingPayload.message, /available|compatible/i);
});

test('9. concurrent reservations allow only one successful reservation', async () => {
  const bank = await BloodBank.findOne({ userId: users['blood-bank'].id });
  const hospital = await Hospital.findOne({ userId: users['hospital-a'].id });
  assert.ok(bank);
  assert.ok(hospital);
  const firstRequest = await createEmergency(hospital._id, users['hospital-a'].id, 'reserve-a');
  const secondRequest = await createEmergency(hospital._id, users['hospital-a'].id, 'reserve-b');
  const firstMatch = await createAcceptedMatch(firstRequest._id, bank._id, users['blood-bank'].id, 'reserve-a');
  const secondMatch = await createAcceptedMatch(secondRequest._id, bank._id, users['blood-bank'].id, 'reserve-b');
  const results = await Promise.all([
    api('/api/inventory/reserve', { method: 'POST', headers: jsonHeaders(users['blood-bank'].cookie), body: JSON.stringify({ matchId: firstMatch._id }) }),
    api('/api/inventory/reserve', { method: 'POST', headers: jsonHeaders(users['blood-bank'].cookie), body: JSON.stringify({ matchId: secondMatch._id }) }),
  ]);
  const statuses = results.map((response) => response.status);
  const payloads = await Promise.all(results.map((response) => response.json()));
  assert.equal(statuses.filter((status) => status === 201).length, 1, JSON.stringify({ statuses, payloads }));
  assert.equal(statuses.filter((status) => status === 409).length, 1, JSON.stringify({ statuses, payloads }));
});

test('10. fulfilled emergency cannot be modified', async () => {
  const request = await EmergencyRequest.findOne({ requestId: `${prefix}-completed` });
  assert.ok(request);
  const response = await api(`/api/emergencies/${request._id}`, {
    method: 'PATCH',
    headers: jsonHeaders(users['hospital-b'].cookie),
    body: JSON.stringify({ status: 'CANCELLED', cancellationReason: 'unauthorized rollback' }),
  });
  assert.notEqual(response.status, 200);
  const unchanged = await EmergencyRequest.findById(request._id);
  assert.ok(unchanged);
  assert.equal(unchanged.status, 'FULFILLED');
});
