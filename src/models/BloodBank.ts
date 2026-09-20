import mongoose, { Schema, Document, Model } from 'mongoose';

export type BloodBankOperationalStatus = 'OPEN' | 'LIMITED' | 'UNAVAILABLE' | 'CLOSED';

export interface IBloodBank extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  licenseNumber: string;
  type: 'STANDALONE' | 'HOSPITAL_ATTACHED' | 'RED_CROSS' | 'GOVERNMENT';
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
  isOpen: boolean;
  operationalStatus: BloodBankOperationalStatus;
  componentCapabilities: string[];
  totalResponseCount: number;
  acceptedResponseCount: number;
  avgResponseTimeMinutes?: number;
  createdAt: Date;
  updatedAt: Date;
}

const BloodBankSchema = new Schema<IBloodBank>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true },
    licenseNumber: { type: String, required: true, unique: true },
    type: { type: String, enum: ['STANDALONE', 'HOSPITAL_ATTACHED', 'RED_CROSS', 'GOVERNMENT'], required: true },
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
    operatingHours: { type: String, required: true },
    isOpen: { type: Boolean, default: true },
    operationalStatus: {
      type: String,
      enum: ['OPEN', 'LIMITED', 'UNAVAILABLE', 'CLOSED'],
      default: 'OPEN',
    },
    componentCapabilities: [{ type: String }],
    totalResponseCount: { type: Number, default: 0 },
    acceptedResponseCount: { type: Number, default: 0 },
    avgResponseTimeMinutes: { type: Number },
  },
  { timestamps: true }
);

BloodBankSchema.index({ userId: 1 }, { unique: true });
BloodBankSchema.index({ location: '2dsphere' });
BloodBankSchema.index({ isOpen: 1, operationalStatus: 1, location: '2dsphere' });
BloodBankSchema.index({ licenseNumber: 1 }, { unique: true });

BloodBankSchema.pre('save', function () {
  if (this.operationalStatus) {
    this.isOpen = ['OPEN', 'LIMITED'].includes(this.operationalStatus);
  }
});

export const BloodBank: Model<IBloodBank> = mongoose.models.BloodBank || mongoose.model<IBloodBank>('BloodBank', BloodBankSchema);
