import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDonor extends Document {
  userId: mongoose.Types.ObjectId;
  bloodGroup: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  dateOfBirth?: Date;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  address: string;
  city: string;
  state: string;
  pincode: string;
  location: {
    type: string;
    coordinates: number[];
  };
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

const DonorSchema = new Schema<IDonor>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], required: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER'] },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    location: {
      type: { type: String, enum: ['Point'], required: true, default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    isAvailable: { type: Boolean, default: true },
    availabilityRadius: { type: Number, default: 10 },
    emergencyNotificationsEnabled: { type: Boolean, default: true },
    lastDonationDate: { type: Date },
    totalDonations: { type: Number, default: 0 },
    totalResponseCount: { type: Number, default: 0 },
    acceptedResponseCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

DonorSchema.index({ userId: 1 }, { unique: true });
DonorSchema.index({ bloodGroup: 1, isAvailable: 1, location: '2dsphere' });
DonorSchema.index({ isAvailable: 1 });

export const Donor: Model<IDonor> = mongoose.models.Donor || mongoose.model<IDonor>('Donor', DonorSchema);
