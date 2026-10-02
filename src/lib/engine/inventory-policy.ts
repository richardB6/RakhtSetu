export interface CompatibleInventoryStock {
  bloodGroup: string;
  component: string;
  availableUnits: number;
  status?: string;
  operationallyUnavailable?: boolean;
}

export function getCompatibleAvailableUnits(
  items: CompatibleInventoryStock[],
  compatibleBloodGroups: string[],
  component: string
) {
  const compatible = new Set(compatibleBloodGroups);
  return items.reduce((total, item) => {
    if (
      !compatible.has(item.bloodGroup) ||
      item.component !== component ||
      item.status === 'UNAVAILABLE' ||
      item.operationallyUnavailable === true ||
      !Number.isFinite(item.availableUnits) ||
      item.availableUnits <= 0
    ) {
      return total;
    }
    return total + item.availableUnits;
  }, 0);
}

export function planCompatibleInventoryReservation<T extends CompatibleInventoryStock & { _id: unknown }>(
  items: T[],
  compatibleBloodGroups: string[],
  component: string,
  units: number
) {
  if (!Number.isFinite(units) || units <= 0) {
    throw new Error('Reservation quantity must be greater than zero.');
  }
  const groupOrder = new Map(compatibleBloodGroups.map((bloodGroup, index) => [bloodGroup, index]));
  const orderedItems = [...items]
    .filter((item) =>
      groupOrder.has(item.bloodGroup) &&
      item.component === component &&
      item.status !== 'UNAVAILABLE' &&
      item.operationallyUnavailable !== true &&
      Number.isFinite(item.availableUnits) &&
      item.availableUnits > 0
    )
    .sort((left, right) =>
      (groupOrder.get(left.bloodGroup) ?? Number.MAX_SAFE_INTEGER) -
        (groupOrder.get(right.bloodGroup) ?? Number.MAX_SAFE_INTEGER) ||
      String(left._id).localeCompare(String(right._id))
    );

  if (getCompatibleAvailableUnits(orderedItems, compatibleBloodGroups, component) < units) {
    throw new Error('Insufficient inventory to reserve the requested quantity.');
  }

  let remaining = units;
  return orderedItems.flatMap((item) => {
    if (remaining <= 0) return [];
    const allocation = Math.min(item.availableUnits, remaining);
    remaining -= allocation;
    return [{ item, units: allocation }];
  });
}

export function validateInventoryState(input: { availableUnits: number; reservedUnits: number; totalUnits?: number }) {
  if (!Number.isFinite(input.availableUnits) || input.availableUnits < 0) {
    throw new Error('Inventory available quantity must be a non-negative number.');
  }
  if (!Number.isFinite(input.reservedUnits) || input.reservedUnits < 0) {
    throw new Error('Inventory reserved quantity must be a non-negative number.');
  }
  if (input.totalUnits !== undefined && input.reservedUnits > input.totalUnits) {
    throw new Error('Inventory reserved quantity cannot exceed total stock.');
  }
  if (input.totalUnits === undefined && input.reservedUnits > input.availableUnits) {
    throw new Error('Inventory reserved quantity cannot exceed available stock.');
  }
  return true;
}

export function reserveInventoryUnits(state: { availableUnits: number; reservedUnits: number; totalUnits?: number }, units: number) {
  if (!Number.isFinite(units) || units <= 0) throw new Error('Reservation quantity must be greater than zero.');
  validateInventoryState(state);
  if (state.availableUnits < units) throw new Error('Insufficient inventory to reserve the requested quantity.');
  return { availableUnits: state.availableUnits - units, reservedUnits: state.reservedUnits + units };
}

export function releaseInventoryReservation(state: { availableUnits: number; reservedUnits: number; totalUnits?: number }, units: number) {
  if (!Number.isFinite(units) || units <= 0) throw new Error('Release quantity must be greater than zero.');
  validateInventoryState(state);
  if (state.reservedUnits < units) throw new Error('Cannot release more reserved units than currently reserved.');
  return { availableUnits: state.availableUnits + units, reservedUnits: state.reservedUnits - units };
}
