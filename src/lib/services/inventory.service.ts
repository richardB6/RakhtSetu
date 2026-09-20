import { connectToDatabase } from '@/lib/db/mongodb';
import { Inventory } from '@/models/Inventory';
import { BloodGroup, ComponentType } from '@/lib/engine/compatibility';

export async function getInventory(bloodBankId: string) {
  await connectToDatabase();
  return await Inventory.find({ bloodBankId }).sort({ bloodGroup: 1, component: 1 });
}

export async function updateInventory(
  bloodBankId: string,
  bloodGroup: BloodGroup,
  component: ComponentType,
  availableUnits: number
) {
  await connectToDatabase();

  const item = await Inventory.findOneAndUpdate(
    { bloodBankId, bloodGroup, component },
    { 
      $set: { 
        availableUnits,
        lastUpdated: new Date()
      } 
    },
    { new: true, upsert: true }
  );

  return item;
}

export async function reserveUnits(
  bloodBankId: string,
  bloodGroup: BloodGroup,
  component: ComponentType,
  units: number
) {
  await connectToDatabase();

  const item = await Inventory.findOneAndUpdate(
    { 
      bloodBankId, 
      bloodGroup, 
      component,
      availableUnits: { $gte: units } // Ensure sufficient stock
    },
    {
      $inc: {
        availableUnits: -units,
        reservedUnits: units
      },
      $set: {
        lastUpdated: new Date()
      }
    },
    { new: true }
  );

  if (!item) {
    throw new Error('Insufficient inventory or item not found');
  }

  return item;
}

export async function releaseReservation(
  bloodBankId: string,
  bloodGroup: BloodGroup,
  component: ComponentType,
  units: number
) {
  await connectToDatabase();

  const item = await Inventory.findOneAndUpdate(
    { 
      bloodBankId, 
      bloodGroup, 
      component,
      reservedUnits: { $gte: units }
    },
    {
      $inc: {
        availableUnits: units,
        reservedUnits: -units
      },
      $set: {
        lastUpdated: new Date()
      }
    },
    { new: true }
  );

  if (!item) {
    throw new Error('Invalid reservation release or item not found');
  }

  return item;
}

export async function getAvailableInventory(
  bloodGroup: BloodGroup,
  component: ComponentType,
  minUnits: number = 1
) {
  await connectToDatabase();

  return await Inventory.find({
    bloodGroup,
    component,
    availableUnits: { $gte: minUnits }
  }).populate('bloodBankId'); // Using the local ref field which should populate BloodBank if defined properly
}

export async function bulkUpdateInventory(
  bloodBankId: string,
  items: Array<{ bloodGroup: BloodGroup; component: ComponentType; availableUnits: number }>
) {
  await connectToDatabase();

  const operations = items.map(item => ({
    updateOne: {
      filter: { bloodBankId, bloodGroup: item.bloodGroup, component: item.component },
      update: { 
        $set: { 
          availableUnits: item.availableUnits,
          lastUpdated: new Date()
        } 
      },
      upsert: true
    }
  }));

  if (operations.length > 0) {
    return await Inventory.bulkWrite(operations);
  }

  return null;
}
