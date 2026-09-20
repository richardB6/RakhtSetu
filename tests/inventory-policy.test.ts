import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
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
