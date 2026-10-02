import mongoose, { Document, Model, Schema } from 'mongoose';
import type { DonorAvailabilityStatus } from '@/models/Donor';

export type ReservationStatus = 'PENDING' | 'ACTIVE' | 'RELEASED' | 'FULFILLED' | 'FAILED';

export interface IReservation extends Document {
  emergencyRequestId: mongoose.Types.ObjectId;
  matchId: mongoose.Types.ObjectId;
  inventoryId?: mongoose.Types.ObjectId;
  inventoryAllocations?: Array<{ inventoryId: mongoose.Types.ObjectId; units: number }>;
  bloodBankId?: mongoose.Types.ObjectId;
  donorId?: mongoose.Types.ObjectId;
  donorAvailabilityStatusBeforeReservation?: DonorAvailabilityStatus;
  donorAvailabilityLockUpdatedAt?: Date;
  resourceUserId: mongoose.Types.ObjectId;
  units: number;
  status: ReservationStatus;
  releaseReason?: string;
  releasedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReservationSchema = new Schema<IReservation>(
  {
    emergencyRequestId: { type: Schema.Types.ObjectId, ref: 'EmergencyRequest', required: true },
    matchId: { type: Schema.Types.ObjectId, ref: 'Match', required: true },
    inventoryId: { type: Schema.Types.ObjectId, ref: 'Inventory' },
    inventoryAllocations: [{
      inventoryId: { type: Schema.Types.ObjectId, ref: 'Inventory', required: true },
      units: { type: Number, required: true, min: 1 },
    }],
    bloodBankId: { type: Schema.Types.ObjectId, ref: 'BloodBank' },
    donorId: { type: Schema.Types.ObjectId, ref: 'Donor' },
    donorAvailabilityStatusBeforeReservation: {
      type: String,
      enum: ['AVAILABLE', 'UNAVAILABLE', 'TEMPORARILY_UNAVAILABLE'],
    },
    donorAvailabilityLockUpdatedAt: { type: Date },
    resourceUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    units: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['PENDING', 'ACTIVE', 'RELEASED', 'FULFILLED', 'FAILED'], required: true },
    releaseReason: { type: String },
    releasedAt: { type: Date },
  },
  { timestamps: true }
);

ReservationSchema.index({ emergencyRequestId: 1, matchId: 1 }, { unique: true });
ReservationSchema.index({ status: 1, emergencyRequestId: 1 });

export const Reservation: Model<IReservation> =
  mongoose.models.Reservation || mongoose.model<IReservation>('Reservation', ReservationSchema);