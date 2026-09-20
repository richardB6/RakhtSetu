import { z } from 'zod';
import { BLOOD_GROUPS, COMPONENT_TYPES, SEVERITY_LEVELS } from '@/lib/engine/compatibility';

export const createEmergencySchema = z.object({
  patientReference: z.string().min(1, 'Patient reference is required'),
  patientAge: z.number().int().min(0).max(150).optional(),
  patientGender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  bloodGroup: z.enum(BLOOD_GROUPS as unknown as [string, ...string[]]),
  component: z.enum(COMPONENT_TYPES as unknown as [string, ...string[]]),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(50),
  severity: z.enum(SEVERITY_LEVELS as unknown as [string, ...string[]]),
  requiredBy: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
  contactPerson: z.string().min(2, 'Contact person is required'),
  contactPhone: z.string().min(10, 'Contact phone is required'),
  notes: z.string().optional(),
});

export const updateEmergencyStatusSchema = z.object({
  status: z.enum([
    'DRAFT', 'CREATED', 'MATCHING', 'RESOURCES_NOTIFIED',
    'RESPONSES_RECEIVED', 'RESOURCE_SELECTED', 'RESERVED',
    'IN_TRANSIT', 'FULFILLED', 'CANCELLED', 'EXPIRED', 'ESCALATED',
  ] as [string, ...string[]]),
  cancellationReason: z.string().optional(),
});

export type CreateEmergencyInput = z.infer<typeof createEmergencySchema>;
export type UpdateEmergencyStatusInput = z.infer<typeof updateEmergencyStatusSchema>;
