/**
 * Registration schema unit tests.
 *
 * Tests the Zod validation schemas used by POST /api/auth/register
 * for all three public roles: DONOR, HOSPITAL, and BLOOD_BANK.
 *
 * These tests run without a MongoDB connection — they validate only the
 * schema layer, which is where the "Invalid role-specific profile" error
 * is generated.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  donorProfileSchema,
  hospitalProfileSchema,
  bloodBankProfileSchema,
  registerSchema,
} from '../src/lib/validations/auth.schema.ts';

// ─── Shared fixture helpers ──────────────────────────────────────────────────

const baseLocation = { type: 'Point' as const, coordinates: [72.8777, 19.076] as [number, number] };
const baseAddress = {
  address: '123 Main Street',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400001',
  location: baseLocation,
};

// ─── DONOR ───────────────────────────────────────────────────────────────────

test('DONOR: valid minimal profile (no optional fields) succeeds', () => {
  const result = donorProfileSchema.safeParse({
    ...baseAddress,
    bloodGroup: 'O+',
  });
  assert.ok(result.success, `Expected success but got: ${!result.success && result.error.message}`);
  assert.equal(result.data.bloodGroup, 'O+');
});

test('DONOR: valid profile WITH lastDonationDate succeeds', () => {
  const result = donorProfileSchema.safeParse({
    ...baseAddress,
    bloodGroup: 'A+',
    lastDonationDate: '2024-01-15',
    availabilityStatus: 'AVAILABLE',
    emergencyNotificationsEnabled: true,
  });
  assert.ok(result.success, `Expected success but got: ${!result.success && result.error.message}`);
  assert.ok(result.data.lastDonationDate instanceof Date, 'lastDonationDate should be a Date');
});

test('DONOR: valid profile WITH dateOfBirth succeeds', () => {
  const result = donorProfileSchema.safeParse({
    ...baseAddress,
    bloodGroup: 'B-',
    dateOfBirth: '1990-05-20',
    gender: 'MALE',
    availabilityStatus: 'AVAILABLE',
  });
  assert.ok(result.success, `Expected success but got: ${!result.success && result.error.message}`);
  assert.ok(result.data.dateOfBirth instanceof Date, 'dateOfBirth should be a Date');
});

test('DONOR: empty-string lastDonationDate is treated as absent (no error)', () => {
  const result = donorProfileSchema.safeParse({
    ...baseAddress,
    bloodGroup: 'AB+',
    lastDonationDate: '',
  });
  assert.ok(result.success, `Expected success but got: ${!result.success && result.error.message}`);
  assert.equal(result.data.lastDonationDate, undefined);
});

test('DONOR: empty-string dateOfBirth is treated as absent (no error)', () => {
  const result = donorProfileSchema.safeParse({
    ...baseAddress,
    bloodGroup: 'O-',
    dateOfBirth: '',
  });
  assert.ok(result.success, `Expected success but got: ${!result.success && result.error.message}`);
  assert.equal(result.data.dateOfBirth, undefined);
});

test('DONOR: unknown field is rejected (.strict protection)', () => {
  const result = donorProfileSchema.safeParse({
    ...baseAddress,
    bloodGroup: 'A-',
    unknownField: 'should fail',
  });
  assert.ok(!result.success, 'Expected failure for unknown field');
});

test('DONOR: missing required bloodGroup is rejected', () => {
  const result = donorProfileSchema.safeParse({
    ...baseAddress,
  });
  assert.ok(!result.success, 'Expected failure for missing bloodGroup');
});

test('DONOR: invalid bloodGroup enum is rejected', () => {
  const result = donorProfileSchema.safeParse({
    ...baseAddress,
    bloodGroup: 'Z+',
  });
  assert.ok(!result.success, 'Expected failure for invalid bloodGroup');
});

test('DONOR: invalid availabilityStatus is rejected', () => {
  const result = donorProfileSchema.safeParse({
    ...baseAddress,
    bloodGroup: 'B+',
    availabilityStatus: 'MAYBE',
  });
  assert.ok(!result.success, 'Expected failure for invalid availabilityStatus');
});

// ─── HOSPITAL ────────────────────────────────────────────────────────────────

const validHospitalProfile = {
  ...baseAddress,
  name: 'Apollo Hospital',
  registrationNumber: 'HOSP-2024-001',
  type: 'PRIVATE' as const,
  contactPerson: 'Dr. Smith',
  contactPhone: '9876543210',
  contactEmail: 'contact@apollo.example.com',
};

test('HOSPITAL: valid profile succeeds', () => {
  const result = hospitalProfileSchema.safeParse(validHospitalProfile);
  assert.ok(result.success, `Expected success but got: ${!result.success && result.error.message}`);
  assert.equal(result.data.name, 'Apollo Hospital');
  assert.equal(result.data.type, 'PRIVATE');
});

test('HOSPITAL: valid profile with operatingHours succeeds', () => {
  const result = hospitalProfileSchema.safeParse({
    ...validHospitalProfile,
    operatingHours: '24/7',
  });
  assert.ok(result.success, `Expected success but got: ${!result.success && result.error.message}`);
});

test('HOSPITAL: valid profile with bedCount and hasBloodStorage succeeds', () => {
  const result = hospitalProfileSchema.safeParse({
    ...validHospitalProfile,
    bedCount: 150,
    hasBloodStorage: true,
  });
  assert.ok(result.success, `Expected success but got: ${!result.success && result.error.message}`);
  assert.equal(result.data.bedCount, 150);
});

test('HOSPITAL: unknown field is rejected (.strict protection)', () => {
  const result = hospitalProfileSchema.safeParse({
    ...validHospitalProfile,
    extraField: 'bad',
  });
  assert.ok(!result.success, 'Expected failure for unknown field');
});

test('HOSPITAL: missing required registrationNumber is rejected', () => {
  const { registrationNumber: _, ...without } = validHospitalProfile;
  const result = hospitalProfileSchema.safeParse(without);
  assert.ok(!result.success, 'Expected failure for missing registrationNumber');
});

test('HOSPITAL: invalid type enum is rejected', () => {
  const result = hospitalProfileSchema.safeParse({
    ...validHospitalProfile,
    type: 'CLINIC',
  });
  assert.ok(!result.success, 'Expected failure for invalid hospital type');
});

test('HOSPITAL: invalid email is rejected', () => {
  const result = hospitalProfileSchema.safeParse({
    ...validHospitalProfile,
    contactEmail: 'not-an-email',
  });
  assert.ok(!result.success, 'Expected failure for invalid contactEmail');
});

// ─── BLOOD_BANK ──────────────────────────────────────────────────────────────

const validBloodBankProfile = {
  ...baseAddress,
  name: 'City Blood Bank',
  licenseNumber: 'BB-2024-001',
  type: 'STANDALONE' as const,
  contactPerson: 'Jane Doe',
  contactPhone: '9123456789',
  contactEmail: 'info@citybloodbank.example.com',
  operatingHours: '24/7',
  componentCapabilities: ['WHOLE_BLOOD', 'PRBC', 'PLATELETS_RDP', 'FFP'],
};

test('BLOOD_BANK: valid profile succeeds', () => {
  const result = bloodBankProfileSchema.safeParse(validBloodBankProfile);
  assert.ok(result.success, `Expected success but got: ${!result.success && result.error.message}`);
  assert.equal(result.data.name, 'City Blood Bank');
  assert.equal(result.data.type, 'STANDALONE');
});

test('BLOOD_BANK: valid profile with operationalStatus succeeds', () => {
  const result = bloodBankProfileSchema.safeParse({
    ...validBloodBankProfile,
    operationalStatus: 'OPEN',
    isOpen: true,
  });
  assert.ok(result.success, `Expected success but got: ${!result.success && result.error.message}`);
});

test('BLOOD_BANK: unknown field is rejected (.strict protection)', () => {
  const result = bloodBankProfileSchema.safeParse({
    ...validBloodBankProfile,
    hackedField: 'bad',
  });
  assert.ok(!result.success, 'Expected failure for unknown field');
});

test('BLOOD_BANK: missing required licenseNumber is rejected', () => {
  const { licenseNumber: _, ...without } = validBloodBankProfile;
  const result = bloodBankProfileSchema.safeParse(without);
  assert.ok(!result.success, 'Expected failure for missing licenseNumber');
});

test('BLOOD_BANK: missing required operatingHours is rejected', () => {
  const { operatingHours: _, ...without } = validBloodBankProfile;
  const result = bloodBankProfileSchema.safeParse(without);
  assert.ok(!result.success, 'Expected failure for missing operatingHours');
});

test('BLOOD_BANK: invalid type enum is rejected', () => {
  const result = bloodBankProfileSchema.safeParse({
    ...validBloodBankProfile,
    type: 'PRIVATE',
  });
  assert.ok(!result.success, 'Expected failure for invalid blood bank type');
});

// ─── registerSchema (top-level) ──────────────────────────────────────────────

test('registerSchema: ADMIN role is accepted by registerSchema (blocked in route handler)', () => {
  // The registerSchema itself allows ADMIN; the route handler explicitly rejects it.
  // This confirms the intended separation of concerns.
  const result = registerSchema.safeParse({
    email: 'admin@example.com',
    password: 'password123',
    name: 'Admin User',
    phone: '9000000000',
    role: 'ADMIN',
  });
  assert.ok(result.success, 'registerSchema should allow ADMIN (route handler rejects it)');
});

test('registerSchema: invalid role is rejected', () => {
  const result = registerSchema.safeParse({
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User',
    phone: '9000000000',
    role: 'SUPER_ADMIN',
  });
  assert.ok(!result.success, 'Expected failure for invalid role');
});

test('registerSchema: short password is rejected', () => {
  const result = registerSchema.safeParse({
    email: 'test@example.com',
    password: '123',
    name: 'Test User',
    phone: '9000000000',
    role: 'DONOR',
  });
  assert.ok(!result.success, 'Expected failure for password shorter than 6 chars');
});

test('registerSchema: invalid email is rejected', () => {
  const result = registerSchema.safeParse({
    email: 'not-valid',
    password: 'password123',
    name: 'Test User',
    phone: '9000000000',
    role: 'DONOR',
  });
  assert.ok(!result.success, 'Expected failure for invalid email');
});
