import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMatch extends Document {
  emergencyRequestId: mongoose.Types.ObjectId;
  resourceType: 'BLOOD_BANK' | 'DONOR';
  resourceId: mongoose.Types.ObjectId;
  resourceUserId: mongoose.Types.ObjectId;
  score: number;
  rank: number;
  factors: {
    compatibilityScore: number;
    availabilityScore: number;
    distanceScore: number;
    verificationScore: number;
    responseReliabilityScore: number;
    urgencyScore: number;
  };
  compatibilityType: 'EXACT' | 'COMPATIBLE' | 'EMERGENCY_UNIVERSAL';
  distanceKm: number;
  availableQuantity: number;
  isVerified: boolean;
  reasons: string[];
  status: 'PENDING' | 'NOTIFIED' | 'ACCEPTED' | 'DECLINED' | 'RESERVED' | 'FULFILLED' | 'EXPIRED' | 'CANCELLED';
  respondedAt?: Date;
  declineReason?: string;
  reservedQuantity?: number;
  notifiedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MatchSchema = new Schema<IMatch>(
  {
    emergencyRequestId: { type: Schema.Types.ObjectId, ref: 'EmergencyRequest', required: true },
    resourceType: { type: String, enum: ['BLOOD_BANK', 'DONOR'], required: true },
    resourceId: { type: Schema.Types.ObjectId, required: true },
    resourceUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    rank: { type: Number, required: true },
    factors: {
      compatibilityScore: { type: Number, required: true },
      availabilityScore: { type: Number, required: true },
      distanceScore: { type: Number, required: true },
      verificationScore: { type: Number, required: true },
      responseReliabilityScore: { type: Number, required: true },
      urgencyScore: { type: Number, required: true },
    },
    compatibilityType: { type: String, enum: ['EXACT', 'COMPATIBLE', 'EMERGENCY_UNIVERSAL'], required: true },
    distanceKm: { type: Number, required: true },
    availableQuantity: { type: Number, required: true },
    isVerified: { type: Boolean, required: true },
    reasons: [{ type: String }],
    status: { 
      type: String, 
      enum: ['PENDING', 'NOTIFIED', 'ACCEPTED', 'DECLINED', 'RESERVED', 'FULFILLED', 'EXPIRED', 'CANCELLED'], 
      default: 'PENDING' 
    },
    respondedAt: { type: Date },
    declineReason: { type: String },
    reservedQuantity: { type: Number },
    notifiedAt: { type: Date },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

MatchSchema.index({ emergencyRequestId: 1, score: -1 });
MatchSchema.index({ resourceId: 1, resourceType: 1 });
MatchSchema.index({ resourceUserId: 1, status: 1 });
MatchSchema.index({ status: 1, expiresAt: 1 });

export const Match: Model<IMatch> = mongoose.models.Match || mongoose.model<IMatch>('Match', MatchSchema);
