import mongoose, { Schema, Document, Model } from 'mongoose';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'EMERGENCY_REQUEST' | 'NEW_MATCH' | 'MATCH_ACCEPTED' | 'MATCH_DECLINED' | 'ESCALATION' | 'FULFILLMENT_UPDATE' | 'VERIFICATION_UPDATE' | 'AVAILABILITY_CHANGE' | 'SYSTEM';
  title: string;
  message: string;
  severity: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'INFO';
  referenceType?: string;
  referenceId?: mongoose.Types.ObjectId;
  channel: 'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH';
  deliveryStatus: 'PENDING' | 'DELIVERED' | 'FAILED' | 'NOT_AVAILABLE';
  deliveryNote?: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { 
      type: String, 
      enum: ['EMERGENCY_REQUEST', 'NEW_MATCH', 'MATCH_ACCEPTED', 'MATCH_DECLINED', 'ESCALATION', 'FULFILLMENT_UPDATE', 'VERIFICATION_UPDATE', 'AVAILABILITY_CHANGE', 'SYSTEM'], 
      required: true 
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    severity: { type: String, enum: ['CRITICAL', 'HIGH', 'NORMAL', 'INFO'], required: true },
    referenceType: { type: String },
    referenceId: { type: Schema.Types.ObjectId },
    channel: { type: String, enum: ['IN_APP', 'EMAIL', 'SMS', 'PUSH'], default: 'IN_APP' },
    deliveryStatus: { type: String, enum: ['PENDING', 'DELIVERED', 'FAILED', 'NOT_AVAILABLE'], default: 'DELIVERED' },
    deliveryNote: { type: String },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, severity: 1, isRead: 1 });
NotificationSchema.index({ createdAt: -1 });

export const Notification: Model<INotification> = mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);
