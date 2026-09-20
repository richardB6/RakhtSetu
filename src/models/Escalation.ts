import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEscalation extends Document {
  emergencyRequestId: mongoose.Types.ObjectId;
  level: number;
  type: 'RADIUS_EXPANSION' | 'ADDITIONAL_RESOURCES' | 'COORDINATOR_ALERT' | 'REGIONAL_ESCALATION';
  trigger: 'AUTO_TIMEOUT' | 'INSUFFICIENT_RESPONSE' | 'MANUAL' | 'NO_AVAILABILITY';
  triggerDetails: string;
  previousRadiusKm?: number;
  newRadiusKm?: number;
  additionalResourcesNotified?: number;
  resolvedBy?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
  resolutionNotes?: string;
  status: 'ACTIVE' | 'RESOLVED' | 'SUPERSEDED';
  createdAt: Date;
  updatedAt: Date;
}

const EscalationSchema = new Schema<IEscalation>(
  {
    emergencyRequestId: { type: Schema.Types.ObjectId, ref: 'EmergencyRequest', required: true },
    level: { type: Number, required: true },
    type: { type: String, enum: ['RADIUS_EXPANSION', 'ADDITIONAL_RESOURCES', 'COORDINATOR_ALERT', 'REGIONAL_ESCALATION'], required: true },
    trigger: { type: String, enum: ['AUTO_TIMEOUT', 'INSUFFICIENT_RESPONSE', 'MANUAL', 'NO_AVAILABILITY'], required: true },
    triggerDetails: { type: String, required: true },
    previousRadiusKm: { type: Number },
    newRadiusKm: { type: Number },
    additionalResourcesNotified: { type: Number },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
    resolutionNotes: { type: String },
    status: { type: String, enum: ['ACTIVE', 'RESOLVED', 'SUPERSEDED'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

EscalationSchema.index({ emergencyRequestId: 1, level: 1 });
EscalationSchema.index({ status: 1, createdAt: -1 });

export const Escalation: Model<IEscalation> = mongoose.models.Escalation || mongoose.model<IEscalation>('Escalation', EscalationSchema);
