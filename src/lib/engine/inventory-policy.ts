export function validateInventoryState(input: { availableUnits: number; reservedUnits: number }) {
  if (!Number.isFinite(input.availableUnits) || input.availableUnits < 0) {
    throw new Error('Inventory available quantity must be a non-negative number.');
  }
  if (!Number.isFinite(input.reservedUnits) || input.reservedUnits < 0) {
    throw new Error('Inventory reserved quantity must be a non-negative number.');
  }
  if (input.reservedUnits > input.availableUnits) {
    throw new Error('Inventory reserved quantity cannot exceed available stock.');
  }
  return true;
}

export function reserveInventoryUnits(state: { availableUnits: number; reservedUnits: number }, units: number) {
  if (!Number.isFinite(units) || units <= 0) throw new Error('Reservation quantity must be greater than zero.');
  validateInventoryState(state);
  if (state.availableUnits < units) throw new Error('Insufficient inventory to reserve the requested quantity.');
  return { availableUnits: state.availableUnits - units, reservedUnits: state.reservedUnits + units };
}

export function releaseInventoryReservation(state: { availableUnits: number; reservedUnits: number }, units: number) {
  if (!Number.isFinite(units) || units <= 0) throw new Error('Release quantity must be greater than zero.');
  validateInventoryState(state);
  if (state.reservedUnits < units) throw new Error('Cannot release more reserved units than currently reserved.');
  return { availableUnits: state.availableUnits + units, reservedUnits: state.reservedUnits - units };
}
