import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getAllocatableInventoryUnits,
  getCompatibleAvailableUnits,
  planCompatibleInventoryReservation,
  releaseInventoryReservation,
  reserveInventoryUnits,
  validateInventoryState,
} from '../src/lib/engine/inventory-policy.ts';

test('inventory invariants reject negative and over-reserved states', () => {
  assert.throws(() => validateInventoryState({ availableUnits: -1, reservedUnits: 0 }), /non-negative/);
  assert.throws(() => validateInventoryState({ availableUnits: 2, reservedUnits: 3 }), /cannot exceed/);
  assert.doesNotThrow(() => validateInventoryState({ availableUnits: 4, reservedUnits: 2 }));
});

test('reservation never exceeds available stock and release restores availability', () => {
  const reserved = reserveInventoryUnits({ availableUnits: 6, reservedUnits: 1 }, 2);
  assert.deepEqual(reserved, { availableUnits: 4, reservedUnits: 3 });
  assert.throws(() => reserveInventoryUnits({ availableUnits: 1, reservedUnits: 0 }, 2), /Insufficient/);
  assert.deepEqual(releaseInventoryReservation(reserved, 2), { availableUnits: 6, reservedUnits: 1 });
  assert.throws(() => releaseInventoryReservation(reserved, 4), /Cannot release/);
});

test('reservation inputs must be positive integers in operational use', () => {
  assert.throws(() => reserveInventoryUnits({ availableUnits: 4, reservedUnits: 0 }, 0), /greater than zero/);
  assert.throws(() => releaseInventoryReservation({ availableUnits: 4, reservedUnits: 1 }, -1), /greater than zero/);
});

test('compatible stock is limited to eligible groups and the requested component', () => {
  const inventory = [
    { _id: 'exact', bloodGroup: 'A+', component: 'WHOLE_BLOOD', availableUnits: 0, status: 'UNAVAILABLE' },
    { _id: 'compatible', bloodGroup: 'O+', component: 'WHOLE_BLOOD', availableUnits: 1, status: 'AVAILABLE' },
    { _id: 'other-component', bloodGroup: 'A+', component: 'PRBC', availableUnits: 8, status: 'AVAILABLE' },
    { _id: 'other-group', bloodGroup: 'B+', component: 'WHOLE_BLOOD', availableUnits: 5, status: 'AVAILABLE' },
    { _id: 'unavailable', bloodGroup: 'O-', component: 'WHOLE_BLOOD', availableUnits: 4, status: 'UNAVAILABLE' },
    { _id: 'operationally-unavailable', bloodGroup: 'O-', component: 'WHOLE_BLOOD', availableUnits: 4, status: 'AVAILABLE', operationallyUnavailable: true },
  ];

  assert.equal(getCompatibleAvailableUnits(inventory, ['A+', 'O+', 'O-'], 'WHOLE_BLOOD'), 1);
  assert.equal(getCompatibleAvailableUnits(inventory, ['A+'], 'WHOLE_BLOOD'), 0);
});

test('allocatable stock excludes unavailable and disabled records and caps inconsistent reserved quantities', () => {
  assert.equal(getAllocatableInventoryUnits({
    bloodGroup: 'AB+',
    component: 'WHOLE_BLOOD',
    availableUnits: 1,
    reservedUnits: 3,
    totalUnits: 4,
    status: 'RESERVED',
  }), 1);
  assert.equal(getAllocatableInventoryUnits({
    bloodGroup: 'AB+',
    component: 'WHOLE_BLOOD',
    availableUnits: 19,
    reservedUnits: 0,
    totalUnits: 19,
    status: 'AVAILABLE',
    operationallyUnavailable: true,
  }), 0);
  assert.equal(getAllocatableInventoryUnits({
    bloodGroup: 'AB+',
    component: 'WHOLE_BLOOD',
    availableUnits: 19,
    reservedUnits: 1,
    totalUnits: 10,
    status: 'AVAILABLE',
  }), 9);
  assert.equal(getAllocatableInventoryUnits({
    bloodGroup: 'AB+',
    component: 'WHOLE_BLOOD',
    availableUnits: 19,
    status: 'UNAVAILABLE',
  }), 0);
});

test('exact requested group and component stock is isolated from other inventory', () => {
  const inventory = [
    { _id: 'requested', bloodGroup: 'AB+', component: 'WHOLE_BLOOD', availableUnits: 1, status: 'AVAILABLE' },
    { _id: 'compatible-group', bloodGroup: 'O-', component: 'WHOLE_BLOOD', availableUnits: 19, status: 'AVAILABLE' },
    { _id: 'other-component', bloodGroup: 'AB+', component: 'PRBC', availableUnits: 19, status: 'AVAILABLE' },
  ];

  assert.equal(getCompatibleAvailableUnits(inventory, ['AB+'], 'WHOLE_BLOOD'), 1);
  assert.throws(
    () => planCompatibleInventoryReservation(inventory, ['AB+'], 'WHOLE_BLOOD', 2),
    /Insufficient inventory/
  );
  assert.deepEqual(
    planCompatibleInventoryReservation(inventory, ['AB+'], 'WHOLE_BLOOD', 1).map(({ units }) => units),
    [1]
  );
});

test('compatible allocation spans eligible records without exceeding available units', () => {
  const inventory = [
    { _id: 'exact', bloodGroup: 'A+', component: 'WHOLE_BLOOD', availableUnits: 1, status: 'AVAILABLE' },
    { _id: 'compatible', bloodGroup: 'O+', component: 'WHOLE_BLOOD', availableUnits: 2, status: 'AVAILABLE' },
  ];
  const allocations = planCompatibleInventoryReservation(inventory, ['A+', 'O+'], 'WHOLE_BLOOD', 2);

  assert.deepEqual(
    allocations.map(({ item, units }) => [item._id, units]),
    [['exact', 1], ['compatible', 1]]
  );
  assert.throws(
    () => planCompatibleInventoryReservation(inventory, ['A+'], 'WHOLE_BLOOD', 2),
    /Insufficient inventory/
  );
});
