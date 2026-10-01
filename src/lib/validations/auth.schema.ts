import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  role: z.enum(['HOSPITAL', 'BLOOD_BANK', 'DONOR', 'ADMIN']),
  profile: z.record(z.string(), z.unknown()).optional(),
});

const locationSchema = z.object({
  type: z.literal('Point').default('Point'),
  coordinates: z.array(z.number()).length(2),
});

/**
 * Preprocessor that converts empty strings and null to undefined so that
 * optional date fields are skipped rather than triggering "Invalid Date".
 */
const optionalDate = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce.date().optional()
);

export const hospitalProfileSchema = z.object({
  name: z.string().trim().min(2),
  registrationNumber: z.string().trim().min(1),
  type: z.enum(['GOVERNMENT', 'PRIVATE', 'MILITARY', 'NGO']),
  address: z.string().trim().min(1),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  pincode: z.string().trim().min(4),
  location: locationSchema,
  contactPerson: z.string().trim().min(2),
  contactPhone: z.string().trim().min(10),
  contactEmail: z.string().email(),
  operatingHours: z.string().trim().min(1).optional(),
  bedCount: z.number().int().nonnegative().optional(),
  hasBloodStorage: z.boolean().optional(),
}).strict();

export const bloodBankProfileSchema = z.object({
  name: z.string().trim().min(2),
  licenseNumber: z.string().trim().min(1),
  type: z.enum(['STANDALONE', 'HOSPITAL_ATTACHED', 'RED_CROSS', 'GOVERNMENT']),
  address: z.string().trim().min(1),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  pincode: z.string().trim().min(4),
  location: locationSchema,
  contactPerson: z.string().trim().min(2),
  contactPhone: z.string().trim().min(10),
  contactEmail: z.string().email(),
  operatingHours: z.string().trim().min(1),
  isOpen: z.boolean().optional(),
  operationalStatus: z.enum(['OPEN', 'LIMITED', 'UNAVAILABLE', 'CLOSED']).optional(),
  componentCapabilities: z.array(z.string()).optional(),
}).strict();

export const donorProfileSchema = z.object({
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  dateOfBirth: optionalDate,
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  address: z.string().trim().min(1),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  pincode: z.string().trim().min(4),
  location: locationSchema,
  availabilityStatus: z.enum(['AVAILABLE', 'UNAVAILABLE', 'TEMPORARILY_UNAVAILABLE']).optional(),
  isAvailable: z.boolean().optional(),
  availabilityRadius: z.number().positive().optional(),
  emergencyNotificationsEnabled: z.boolean().optional(),
  /** Optional – set if the donor has donated before. Left blank → omitted from form payload. */
  lastDonationDate: optionalDate,
}).strict();

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
