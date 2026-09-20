import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVerification extends Document {
  userId: mongoose.Types.ObjectId;
  entityType: 'HOSPITAL' | 'BLOOD_BANK' | 'DONOR';
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  submittedDocuments?: string[];
  verifiedBy?: mongoose.Types.ObjectId;
  verifiedAt?: Date;
  rejectionReason?: string;
  suspensionReason?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VerificationSchema = new Schema<IVerification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    entityType: { type: String, enum: ['HOSPITAL', 'BLOOD_BANK', 'DONOR'], required: true },
    status: { type: String, enum: ['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'], default: 'PENDING' },
    submittedDocuments: [{ type: String }],
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: { type: Date },
    rejectionReason: { type: String },
    suspensionReason: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

VerificationSchema.index({ userId: 1 }, { unique: true });
VerificationSchema.index({ status: 1, entityType: 1 });

export const Verification: Model<IVerification> = mongoose.models.Verification || mongoose.model<IVerification>('Verification', VerificationSchema);
