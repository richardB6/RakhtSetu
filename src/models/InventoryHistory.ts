import mongoose, { Document, Model, Schema } from 'mongoose';

export type InventoryHistoryAction =
  | 'INVENTORY_CREATED'
  | 'INVENTORY_UPDATED'
  | 'INVENTORY_MARKED_UNAVAILABLE'
  | 'INVENTORY_RESTORED'
  | 'INVENTORY_RESERVED'
  | 'INVENTORY_RELEASED'
  | 'INVENTORY_FULFILLED'
  | 'RESERVATION_FAILED';

export interface IInventoryHistory extends Document {
  inventoryId: mongoose.Types.ObjectId;
  bloodBankId: mongoose.Types.ObjectId;
  actorId?: mongoose.Types.ObjectId;
  action: InventoryHistoryAction;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  emergencyRequestId?: mongoose.Types.ObjectId;
  matchId?: mongoose.Types.ObjectId;
  reason?: string;
  createdAt: Date;
}

const InventoryHistorySchema = new Schema<IInventoryHistory>(
  {
    inventoryId: { type: Schema.Types.ObjectId, ref: 'Inventory', required: true },
    bloodBankId: { type: Schema.Types.ObjectId, ref: 'BloodBank', required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    action: {
      type: String,
      enum: [
        'INVENTORY_CREATED',
        'INVENTORY_UPDATED',
        'INVENTORY_MARKED_UNAVAILABLE',
        'INVENTORY_RESTORED',
        'INVENTORY_RESERVED',
        'INVENTORY_RELEASED',
        'INVENTORY_FULFILLED',
        'RESERVATION_FAILED',
      ],
      required: true,
    },
    previousState: { type: Schema.Types.Mixed },
    newState: { type: Schema.Types.Mixed },
    emergencyRequestId: { type: Schema.Types.ObjectId, ref: 'EmergencyRequest' },
    matchId: { type: Schema.Types.ObjectId, ref: 'Match' },
    reason: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

InventoryHistorySchema.index({ bloodBankId: 1, createdAt: -1 });
InventoryHistorySchema.index({ inventoryId: 1, createdAt: -1 });

export const InventoryHistory: Model<IInventoryHistory> =
  mongoose.models.InventoryHistory || mongoose.model<IInventoryHistory>('InventoryHistory', InventoryHistorySchema);