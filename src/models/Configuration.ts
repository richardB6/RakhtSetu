import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IConfiguration extends Document {
  key: string;
  value: any;
  category: 'MATCHING' | 'ESCALATION' | 'NOTIFICATION' | 'SYSTEM';
  description: string;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ConfigurationSchema = new Schema<IConfiguration>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
    category: { type: String, enum: ['MATCHING', 'ESCALATION', 'NOTIFICATION', 'SYSTEM'], required: true },
    description: { type: String, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

ConfigurationSchema.index({ key: 1 }, { unique: true });
ConfigurationSchema.index({ category: 1 });

export const Configuration: Model<IConfiguration> = mongoose.models.Configuration || mongoose.model<IConfiguration>('Configuration', ConfigurationSchema);
