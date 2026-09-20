import {
  BloodGroup,
  ComponentType,
  SeverityLevel,
  RequestStatus,
  MatchStatus,
  VerificationStatus,
  CompatibilityLevel,
} from '@/lib/engine/compatibility';

// ─── User Types ─────────────────────────────────────────────────────────────

export type UserRole = 'HOSPITAL' | 'BLOOD_BANK' | 'DONOR' | 'ADMIN';

export interface IUser {
  _id: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  profileId?: string;
  avatar?: string;
  isActive: boolean;
  verificationStatus: VerificationStatus;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Location ───────────────────────────────────────────────────────────────

export interface IGeoLocation {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface IAddress {
  address: string;
  city: string;
  state: string;
  pincode: string;
  location: IGeoLocation;
}

// ─── Hospital ───────────────────────────────────────────────────────────────

export interface IHospital extends IAddress {
  _id: string;
  userId: string;
  name: string;
  registrationNumber: string;
  type: 'GOVERNMENT' | 'PRIVATE' | 'MILITARY' | 'NGO';
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  operatingHours: string;
  bedCount?: number;
  hasBloodStorage: boolean;
  emergencyRequestCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Blood Bank ─────────────────────────────────────────────────────────────

export type BloodBankOperationalStatus = 'OPEN' | 'LIMITED' | 'UNAVAILABLE' | 'CLOSED';

export interface IBloodBank extends IAddress {
  _id: string;
  userId: string;
  name: string;
  licenseNumber: string;
  type: 'STANDALONE' | 'HOSPITAL_ATTACHED' | 'RED_CROSS' | 'GOVERNMENT';
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  operatingHours: string;
  isOpen: boolean;
  operationalStatus: BloodBankOperationalStatus;
  componentCapabilities: ComponentType[];
  totalResponseCount: number;
  acceptedResponseCount: number;
  avgResponseTimeMinutes?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Donor ──────────────────────────────────────────────────────────────────

export type DonorAvailabilityStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'TEMPORARILY_UNAVAILABLE';

export interface IDonor extends IAddress {
  _id: string;
  userId: string;
  bloodGroup: BloodGroup;
  dateOfBirth?: Date;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  availabilityStatus: DonorAvailabilityStatus;
  isAvailable: boolean;
  availabilityRadius: number;
  emergencyNotificationsEnabled: boolean;
  lastDonationDate?: Date;
  totalDonations: number;
  totalResponseCount: number;
  acceptedResponseCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Emergency Request ──────────────────────────────────────────────────────

export interface IEmergencyRequest {
  _id: string;
  requestId: string;
  hospitalId: string;
  createdBy: string;
  patientReference: string;
  patientAge?: number;
  patientGender?: string;
  bloodGroup: BloodGroup;
  component: ComponentType;
  quantity: number;
  quantityFulfilled: number;
  severity: SeverityLevel;
  requiredBy: Date;
  location: IGeoLocation;
  address: string;
  city: string;
  status: RequestStatus;
  contactPerson: string;
  contactPhone: string;
  notes?: string;
  searchRadiusKm: number;
  matchCount: number;
  responseCount: number;
  responseTimeoutMinutes: number;
  responseDeadline?: Date;
  escalationLevel: number;
  selectedMatchId?: string;
  matchingStartedAt?: Date;
  firstResponseAt?: Date;
  fulfilledAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
  // Populated fields
  hospital?: IHospital;
}

// ─── Match ──────────────────────────────────────────────────────────────────

export interface IMatchFactors {
  compatibilityScore: number;
  availabilityScore: number;
  distanceScore: number;
  verificationScore: number;
  responseReliabilityScore: number;
  urgencyScore: number;
}

export interface IMatch {
  _id: string;
  emergencyRequestId: string;
  resourceType: 'BLOOD_BANK' | 'DONOR';
  resourceId: string;
  resourceUserId: string;
  score: number;
  rank: number;
  factors: IMatchFactors;
  compatibilityType: CompatibilityLevel;
  distanceKm: number;
  availableQuantity: number;
  isVerified: boolean;
  reasons: string[];
  status: MatchStatus;
  respondedAt?: Date;
  declineReason?: string;
  reservedQuantity?: number;
  notifiedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Populated fields
  bloodBank?: IBloodBank;
  donor?: IDonor;
  resourceUser?: IUser;
}

// ─── Inventory ──────────────────────────────────────────────────────────────

export interface IInventory {
  _id: string;
  bloodBankId: string;
  bloodGroup: BloodGroup;
  component: ComponentType;
  availableUnits: number;
  reservedUnits: number;
  totalUnits: number;
  lastUpdated: Date;
  lastVerified?: Date;
  expiryAlertThresholdDays?: number;
  minimumStockLevel?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Notification ───────────────────────────────────────────────────────────

export type NotificationType =
  | 'EMERGENCY_REQUEST'
  | 'NEW_MATCH'
  | 'MATCH_ACCEPTED'
  | 'MATCH_DECLINED'
  | 'ESCALATION'
  | 'FULFILLMENT_UPDATE'
  | 'VERIFICATION_UPDATE'
  | 'AVAILABILITY_CHANGE'
  | 'SYSTEM';

export type NotificationSeverity = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'INFO';

export interface INotification {
  _id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: NotificationSeverity;
  priority: number;
  referenceType?: string;
  referenceId?: string;
  channel: 'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH';
  deliveryStatus: 'PENDING' | 'DELIVERED' | 'FAILED' | 'NOT_AVAILABLE';
  deliveryNote?: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

// ─── Escalation ─────────────────────────────────────────────────────────────

export interface IEscalation {
  _id: string;
  emergencyRequestId: string;
  level: number;
  type: 'RADIUS_EXPANSION' | 'ADDITIONAL_RESOURCES' | 'COORDINATOR_ALERT' | 'REGIONAL_ESCALATION';
  trigger: 'AUTO_TIMEOUT' | 'INSUFFICIENT_RESPONSE' | 'MANUAL' | 'NO_AVAILABILITY';
  triggerDetails: string;
  previousRadiusKm?: number;
  newRadiusKm?: number;
  additionalResourcesNotified?: number;
  resolvedBy?: string;
  resolvedAt?: Date;
  resolutionNotes?: string;
  status: 'ACTIVE' | 'RESOLVED' | 'SUPERSEDED';
  createdAt: Date;
  updatedAt: Date;
}

// ─── Audit Log ──────────────────────────────────────────────────────────────

export interface IAuditLog {
  _id: string;
  userId: string;
  userRole: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
  };
  description: string;
  createdAt: Date;
}

// ─── API Response Types ─────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Dashboard Stats ────────────────────────────────────────────────────────

export interface DashboardStats {
  activeEmergencies: number;
  criticalRequests: number;
  availableResources: number;
  avgResponseTimeMinutes: number;
  fulfillmentRate: number;
  matchingInProgress: number;
  totalFulfilled: number;
  totalDonors: number;
  totalBloodBanks: number;
  totalHospitals: number;
}

// Re-exports for convenience
export type {
  BloodGroup,
  ComponentType,
  SeverityLevel,
  RequestStatus,
  MatchStatus,
  VerificationStatus,
  CompatibilityLevel,
};
