import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEmergencyRequest extends Document {
  requestId: string;
  hospitalId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  patientReference: string;
  patientAge?: number;
  patientGender?: string;
  bloodGroup: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  component: 'WHOLE_BLOOD' | 'PRBC' | 'PLATELETS_RDP' | 'PLATELETS_SDP' | 'FFP' | 'CRYO';
  quantity: number;
  quantityFulfilled: number;
  severity: 'CRITICAL' | 'HIGH' | 'NORMAL';
  requiredBy: Date;
  location: {
    type: string;
    coordinates: number[];
  };
  address: string;
  city: string;
  status: 'DRAFT' | 'CREATED' | 'MATCHING' | 'RESOURCES_NOTIFIED' | 'RESPONSES_RECEIVED' | 'RESOURCE_SELECTED' | 'RESERVED' | 'PROCESSING' | 'IN_TRANSIT' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED' | 'ESCALATED';
  contactPerson: string;
  contactPhone: string;
  notes?: string;
  searchRadiusKm: number;
  matchCount: number;
  responseCount: number;
  responseTimeoutMinutes: number;
  responseDeadline?: Date;
  escalationLevel: number;
  selectedMatchId?: mongoose.Types.ObjectId;
  matchingStartedAt?: Date;
  firstResponseAt?: Date;
  fulfilledAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EmergencyRequestSchema = new Schema<IEmergencyRequest>(
  {
    requestId: { type: String, required: true, unique: true },
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    patientReference: { type: String, required: true },
    patientAge: { type: Number },
    patientGender: { type: String },
    bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], required: true },
    component: { type: String, enum: ['WHOLE_BLOOD', 'PRBC', 'PLATELETS_RDP', 'PLATELETS_SDP', 'FFP', 'CRYO'], required: true },
    quantity: { type: Number, required: true, min: 1 },
    quantityFulfilled: { type: Number, default: 0 },
    severity: { type: String, enum: ['CRITICAL', 'HIGH', 'NORMAL'], required: true },
    requiredBy: { type: Date, required: true },
    location: {
      type: { type: String, enum: ['Point'], required: true, default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    address: { type: String, required: true },
    city: { type: String, required: true },
    status: { 
      type: String, 
      enum: ['DRAFT', 'CREATED', 'MATCHING', 'RESOURCES_NOTIFIED', 'RESPONSES_RECEIVED', 'RESOURCE_SELECTED', 'RESERVED', 'PROCESSING', 'IN_TRANSIT', 'FULFILLED', 'CANCELLED', 'EXPIRED', 'ESCALATED'], 
      default: 'CREATED' 
    },
    contactPerson: { type: String, required: true },
    contactPhone: { type: String, required: true },
    notes: { type: String },
    searchRadiusKm: { type: Number, default: 10 },
    matchCount: { type: Number, default: 0 },
    responseCount: { type: Number, default: 0 },
      responseTimeoutMinutes: { type: Number, default: 15, min: 1 },
      responseDeadline: { type: Date },
      escalationLevel: { type: Number, default: 0, min: 0 },
      selectedMatchId: { type: Schema.Types.ObjectId, ref: 'Match' },
    matchingStartedAt: { type: Date },
    firstResponseAt: { type: Date },
    fulfilledAt: { type: Date },
    cancelledAt: { type: Date },
    cancellationReason: { type: String },
  },
  { timestamps: true }
);

EmergencyRequestSchema.index({ requestId: 1 }, { unique: true });
EmergencyRequestSchema.index({ status: 1, severity: 1, createdAt: -1 });
EmergencyRequestSchema.index({ hospitalId: 1, status: 1 });
EmergencyRequestSchema.index({ location: '2dsphere' });
EmergencyRequestSchema.index({ bloodGroup: 1, component: 1, status: 1 });
EmergencyRequestSchema.index({ severity: 1, requiredBy: 1 });
EmergencyRequestSchema.index({ createdAt: -1 });

export const EmergencyRequest: Model<IEmergencyRequest> = mongoose.models.EmergencyRequest || mongoose.model<IEmergencyRequest>('EmergencyRequest', EmergencyRequestSchema);
