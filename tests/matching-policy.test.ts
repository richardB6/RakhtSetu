import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCompatibilityLevel } from '../src/lib/engine/compatibility.ts';
import { rankResources } from '../src/lib/engine/matching-policy.ts';

test('uses the configured component compatibility matrix', () => {
  assert.equal(getCompatibilityLevel('A+', 'A+', 'PRBC'), 'EXACT');
  assert.equal(getCompatibilityLevel('A+', 'O-', 'PRBC'), 'EMERGENCY_UNIVERSAL');
  assert.equal(getCompatibilityLevel('A+', 'B+', 'PRBC'), null);
  assert.equal(getCompatibilityLevel('O+', 'AB+', 'FFP'), 'EMERGENCY_UNIVERSAL');
});

test('ranks operational matches deterministically', () => {
  const ranked = rankResources([
    { score: 80, factors: { compatibilityScore: 75 }, distanceKm: 4, resourceType: 'DONOR', resourceId: { toString: () => 'b' } },
    { score: 80, factors: { compatibilityScore: 100 }, distanceKm: 9, resourceType: 'BLOOD_BANK', resourceId: { toString: () => 'c' } },
    { score: 80, factors: { compatibilityScore: 100 }, distanceKm: 2, resourceType: 'BLOOD_BANK', resourceId: { toString: () => 'a' } },
  ]);
  assert.deepEqual(ranked.map((resource) => resource.resourceId.toString()), ['a', 'c', 'b']);
});
