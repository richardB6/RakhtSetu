import mongoose, { Schema, Document, Model } from 'mongoose';

export type InventoryStatus = 'AVAILABLE' | 'RESERVED' | 'UNAVAILABLE';

export interface IInventory extends Document {
  bloodBankId: mongoose.Types.ObjectId;
  bloodGroup: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  component: string;
  availableUnits: number;
  reservedUnits: number;
  totalUnits: number;
  status: InventoryStatus;
  lastUpdated: Date;
  lastVerified?: Date;
  expiryAlertThresholdDays?: number;
  minimumStockLevel?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InventorySchema = new Schema<IInventory>(
  {
    bloodBankId: { type: Schema.Types.ObjectId, ref: 'BloodBank', required: true },
    bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], required: true },
    component: { type: String, required: true },
    availableUnits: { type: Number, default: 0, min: 0 },
    reservedUnits: { type: Number, default: 0, min: 0 },
    totalUnits: { type: Number, default: 0 },
    status: { type: String, enum: ['AVAILABLE', 'RESERVED', 'UNAVAILABLE'], default: 'AVAILABLE' },
    lastUpdated: { type: Date, required: true },
    lastVerified: { type: Date },
    expiryAlertThresholdDays: { type: Number },
    minimumStockLevel: { type: Number },
    notes: { type: String },
  },
  { timestamps: true }
);

InventorySchema.index({ bloodBankId: 1, bloodGroup: 1, component: 1 }, { unique: true });
InventorySchema.index({ bloodGroup: 1, component: 1, availableUnits: 1 });
InventorySchema.index({ availableUnits: 1 });

InventorySchema.pre('save', function () {
  this.totalUnits = this.availableUnits + this.reservedUnits;
  if (this.availableUnits <= 0) {
    this.status = 'UNAVAILABLE';
  } else if (this.reservedUnits > 0) {
    this.status = 'RESERVED';
  } else {
    this.status = 'AVAILABLE';
  }
});

export const Inventory: Model<IInventory> = mongoose.models.Inventory || mongoose.model<IInventory>('Inventory', InventorySchema);
