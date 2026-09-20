/**
 * RakthSetu — Blood/Component Compatibility Engine
 * 
 * DETERMINISTIC, CONFIGURABLE RULES.
 * These are operational compatibility policies based on standard transfusion
 * medicine (AABB Technical Manual, BSH Guidelines).
 * 
 * NO LLM or AI is used for clinical compatibility decisions.
 * Final clinical release/crossmatch is the responsibility of authorized
 * blood bank medical officers.
 */

// ─── Blood Groups ───────────────────────────────────────────────────────────

export const BLOOD_GROUPS = [
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-',
] as const;

export type BloodGroup = (typeof BLOOD_GROUPS)[number];

// ─── Component Types ────────────────────────────────────────────────────────

export const COMPONENT_TYPES = [
  'WHOLE_BLOOD',
  'PRBC',
  'PLATELETS_RDP',
  'PLATELETS_SDP',
  'FFP',
  'CRYO',
] as const;

export type ComponentType = (typeof COMPONENT_TYPES)[number];

export const COMPONENT_LABELS: Record<ComponentType, string> = {
  WHOLE_BLOOD: 'Whole Blood',
  PRBC: 'Packed Red Blood Cells',
  PLATELETS_RDP: 'Platelets (Random Donor)',
  PLATELETS_SDP: 'Platelets (Single Donor / Apheresis)',
  FFP: 'Fresh Frozen Plasma',
  CRYO: 'Cryoprecipitate',
};

// ─── Compatibility Type ─────────────────────────────────────────────────────

export type CompatibilityLevel = 'EXACT' | 'COMPATIBLE' | 'EMERGENCY_UNIVERSAL';

// ─── RBC Compatibility Matrix ───────────────────────────────────────────────
// Recipient → list of compatible donor blood groups (ordered by preference)

export const RBC_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
  'O-':  ['O-'],
  'O+':  ['O+', 'O-'],
  'A-':  ['A-', 'O-'],
  'A+':  ['A+', 'A-', 'O+', 'O-'],
  'B-':  ['B-', 'O-'],
  'B+':  ['B+', 'B-', 'O+', 'O-'],
  'AB-': ['AB-', 'A-', 'B-', 'O-'],
  'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
};

// ─── Plasma (FFP) Compatibility Matrix ──────────────────────────────────────
// Reversed from RBC: AB is universal donor for plasma

export const PLASMA_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
  'O-':  ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'O+':  ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'A-':  ['A-', 'A+', 'AB-', 'AB+'],
  'A+':  ['A-', 'A+', 'AB-', 'AB+'],
  'B-':  ['B-', 'B+', 'AB-', 'AB+'],
  'B+':  ['B-', 'B+', 'AB-', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB-', 'AB+'],
};

// ─── Platelet Compatibility ─────────────────────────────────────────────────
// Prefer identical, then compatible (follows RBC pattern for operational matching)

export const PLATELET_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = RBC_COMPATIBILITY;

// ─── Cryoprecipitate Compatibility ──────────────────────────────────────────
// Follows plasma rules (prefer compatible), any ABO acceptable in emergency

export const CRYO_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = PLASMA_COMPATIBILITY;

// ─── Component → Compatibility Table Mapping ────────────────────────────────

export const COMPONENT_COMPATIBILITY_MAP: Record<
  ComponentType,
  Record<BloodGroup, BloodGroup[]>
> = {
  WHOLE_BLOOD: RBC_COMPATIBILITY,
  PRBC: RBC_COMPATIBILITY,
  PLATELETS_RDP: PLATELET_COMPATIBILITY,
  PLATELETS_SDP: PLATELET_COMPATIBILITY,
  FFP: PLASMA_COMPATIBILITY,
  CRYO: CRYO_COMPATIBILITY,
};

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Get compatible donor blood groups for a given recipient and component type.
 * Returns an ordered list (most preferred first).
 */
export function getCompatibleDonorGroups(
  recipientBloodGroup: BloodGroup,
  component: ComponentType
): BloodGroup[] {
  const matrix = COMPONENT_COMPATIBILITY_MAP[component];
  return matrix[recipientBloodGroup] || [];
}

/**
 * Check if a specific donor blood group is compatible with a recipient
 * for a given component type.
 */
export function isCompatible(
  recipientBloodGroup: BloodGroup,
  donorBloodGroup: BloodGroup,
  component: ComponentType
): boolean {
  const compatible = getCompatibleDonorGroups(recipientBloodGroup, component);
  return compatible.includes(donorBloodGroup);
}

/**
 * Determine the compatibility level between donor and recipient.
 */
export function getCompatibilityLevel(
  recipientBloodGroup: BloodGroup,
  donorBloodGroup: BloodGroup,
  component: ComponentType
): CompatibilityLevel | null {
  if (!isCompatible(recipientBloodGroup, donorBloodGroup, component)) {
    return null;
  }

  // Exact match: same blood group
  if (recipientBloodGroup === donorBloodGroup) {
    return 'EXACT';
  }

  // Emergency universal: O- for RBC, AB for plasma
  const isRBCComponent = ['WHOLE_BLOOD', 'PRBC', 'PLATELETS_RDP', 'PLATELETS_SDP'].includes(component);
  if (isRBCComponent && donorBloodGroup === 'O-') {
    return 'EMERGENCY_UNIVERSAL';
  }
  if (!isRBCComponent && (donorBloodGroup === 'AB+' || donorBloodGroup === 'AB-')) {
    return 'EMERGENCY_UNIVERSAL';
  }

  return 'COMPATIBLE';
}

// ─── Emergency Severity ─────────────────────────────────────────────────────

export const SEVERITY_LEVELS = ['CRITICAL', 'HIGH', 'NORMAL'] as const;
export type SeverityLevel = (typeof SEVERITY_LEVELS)[number];

export const SEVERITY_CONFIG: Record<
  SeverityLevel,
  { label: string; color: string; initialRadiusKm: number; maxResponseTimeMinutes: number }
> = {
  CRITICAL: {
    label: 'Critical',
    color: 'red',
    initialRadiusKm: 10,
    maxResponseTimeMinutes: 5,
  },
  HIGH: {
    label: 'High',
    color: 'amber',
    initialRadiusKm: 15,
    maxResponseTimeMinutes: 15,
  },
  NORMAL: {
    label: 'Normal',
    color: 'blue',
    initialRadiusKm: 25,
    maxResponseTimeMinutes: 60,
  },
};

// ─── Request Statuses ───────────────────────────────────────────────────────

export const REQUEST_STATUSES = [
  'DRAFT',
  'CREATED',
  'MATCHING',
  'RESOURCES_NOTIFIED',
  'RESPONSES_RECEIVED',
  'RESOURCE_SELECTED',
  'RESERVED',
  'PROCESSING',
  'IN_TRANSIT',
  'FULFILLED',
  'CANCELLED',
  'EXPIRED',
  'ESCALATED',
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const VALID_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  DRAFT: ['CREATED', 'CANCELLED'],
  CREATED: ['MATCHING', 'CANCELLED'],
  MATCHING: ['RESOURCES_NOTIFIED', 'ESCALATED', 'CANCELLED', 'EXPIRED'],
  RESOURCES_NOTIFIED: ['RESPONSES_RECEIVED', 'ESCALATED', 'CANCELLED', 'EXPIRED'],
  RESPONSES_RECEIVED: ['RESOURCE_SELECTED', 'ESCALATED', 'CANCELLED'],
  RESOURCE_SELECTED: ['RESERVED', 'CANCELLED'],
  RESERVED: ['PROCESSING', 'IN_TRANSIT', 'FULFILLED', 'CANCELLED'],
  PROCESSING: ['IN_TRANSIT', 'FULFILLED', 'CANCELLED'],
  IN_TRANSIT: ['FULFILLED'],
  ESCALATED: ['MATCHING', 'RESOURCES_NOTIFIED', 'CANCELLED'],
  FULFILLED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export const ACTIVE_STATUSES: RequestStatus[] = [
  'CREATED', 'MATCHING', 'RESOURCES_NOTIFIED', 'RESPONSES_RECEIVED',
  'RESOURCE_SELECTED', 'RESERVED', 'IN_TRANSIT', 'ESCALATED',
];

export const TERMINAL_STATUSES: RequestStatus[] = ['FULFILLED', 'CANCELLED', 'EXPIRED'];

/**
 * Validate a state transition.
 */
export function isValidTransition(
  currentStatus: RequestStatus,
  newStatus: RequestStatus
): boolean {
  return VALID_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

// ─── Match Statuses ─────────────────────────────────────────────────────────

export const MATCH_STATUSES = [
  'PENDING', 'NOTIFIED', 'ACCEPTED', 'DECLINED',
  'RESERVED', 'FULFILLED', 'EXPIRED', 'CANCELLED',
] as const;

export type MatchStatus = (typeof MATCH_STATUSES)[number];

// ─── Verification Statuses ──────────────────────────────────────────────────

export const VERIFICATION_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
