import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAuditLog extends Document {
  userId: mongoose.Types.ObjectId;
  userRole: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: mongoose.Types.ObjectId;
  previousState?: any;
  newState?: any;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
  };
  description: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userRole: { type: String, required: true },
    userName: { type: String, required: true },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    previousState: { type: Schema.Types.Mixed },
    newState: { type: Schema.Types.Mixed },
    metadata: {
      ipAddress: { type: String },
      userAgent: { type: String },
    },
    description: { type: String, required: true },
  },
  { 
    timestamps: { createdAt: true, updatedAt: false } 
  }
);

AuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ createdAt: -1 });

export const AuditLog: Model<IAuditLog> = mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
