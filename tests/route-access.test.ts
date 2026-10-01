import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findProtectedRoute } from '../src/lib/auth/route-access.ts';

test('donor and donor-network paths resolve to distinct role policies', () => {
  assert.deepEqual(findProtectedRoute('/donor')?.roles, ['DONOR']);
  assert.deepEqual(findProtectedRoute('/donor/availability')?.roles, ['DONOR']);
  assert.deepEqual(findProtectedRoute('/donors')?.roles, ['ADMIN', 'BLOOD_BANK']);
  assert.deepEqual(findProtectedRoute('/donors/123')?.roles, ['ADMIN', 'BLOOD_BANK']);
  assert.equal(findProtectedRoute('/donorship'), undefined);
});