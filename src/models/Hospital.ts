import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IHospital extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  registrationNumber: string;
  type: 'GOVERNMENT' | 'PRIVATE' | 'MILITARY' | 'NGO';
  address: string;
  city: string;
  state: string;
  pincode: string;
  location: {
    type: string;
    coordinates: number[];
  };
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

const HospitalSchema = new Schema<IHospital>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true },
    registrationNumber: { type: String, unique: true, required: true },
    type: { type: String, enum: ['GOVERNMENT', 'PRIVATE', 'MILITARY', 'NGO'], required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    location: {
      type: { type: String, enum: ['Point'], required: true, default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    contactPerson: { type: String, required: true },
    contactPhone: { type: String, required: true },
    contactEmail: { type: String, required: true },
    operatingHours: { type: String, default: '24/7' },
    bedCount: { type: Number },
    hasBloodStorage: { type: Boolean, default: false },
    emergencyRequestCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

HospitalSchema.index({ userId: 1 }, { unique: true });
HospitalSchema.index({ location: '2dsphere' });
HospitalSchema.index({ city: 1, state: 1 });
HospitalSchema.index({ registrationNumber: 1 }, { unique: true });

export const Hospital: Model<IHospital> = mongoose.models.Hospital || mongoose.model<IHospital>('Hospital', HospitalSchema);
