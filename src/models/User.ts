import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUserDocument extends Document {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: 'HOSPITAL' | 'BLOOD_BANK' | 'DONOR' | 'ADMIN';
  profileId?: mongoose.Types.ObjectId;
  avatar?: string;
  isActive: boolean;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUserDocument>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false, // Never returned by default
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      trim: true,
    },
    role: {
      type: String,
      enum: ['HOSPITAL', 'BLOOD_BANK', 'DONOR', 'ADMIN'],
      required: [true, 'Role is required'],
    },
    profileId: {
      type: Schema.Types.ObjectId,
      refPath: 'role',
    },
    avatar: String,
    isActive: {
      type: Boolean,
      default: true,
    },
    verificationStatus: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'],
      default: 'PENDING',
    },
    lastLoginAt: Date,
  },
  {
    timestamps: true,
  }
);

// Compound index for admin queries
UserSchema.index({ role: 1, verificationStatus: 1 });
UserSchema.index({ profileId: 1 });

export const User: Model<IUserDocument> =
  mongoose.models.User || mongoose.model<IUserDocument>('User', UserSchema);
