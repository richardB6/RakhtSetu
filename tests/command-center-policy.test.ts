import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculatePercentage, canViewRoleDashboard, getCommandCenterRange, getCommandCenterWindow, getResponseStatus } from '../src/lib/engine/command-center-policy.ts';

test('command center uses a bounded historical window', () => {
  const now = new Date('2026-09-20T12:00:00.000Z');
  assert.equal(getCommandCenterWindow(7, now).toISOString(), '2026-09-13T12:00:00.000Z');
});

test('response status reflects the strongest observed match state', () => {
  assert.equal(getResponseStatus([]), 'WAITING');
  assert.equal(getResponseStatus(['NOTIFIED', 'DECLINED']), 'NOTIFIED');
  assert.equal(getResponseStatus(['DECLINED', 'RESERVED']), 'RESPONDED');
});

test('insufficient fulfillment data is represented as null', () => {
  assert.equal(calculatePercentage(0, 0), null);
  assert.equal(calculatePercentage(1, 4), 25);
});

test('custom date filters are resolved on the server boundary', () => {
  const range = getCommandCenterRange(30, '2026-09-01T00:00:00.000Z', '2026-09-07T23:59:59.000Z');
  assert.equal(range.since.toISOString(), '2026-09-01T00:00:00.000Z');
  assert.equal(range.until.toISOString(), '2026-09-07T23:59:59.000Z');
});

test('role dashboards cannot cross hospital and blood-bank boundaries', () => {
  assert.equal(canViewRoleDashboard('HOSPITAL', 'HOSPITAL'), true);
  assert.equal(canViewRoleDashboard('HOSPITAL', 'BLOOD_BANK'), false);
  assert.equal(canViewRoleDashboard('BLOOD_BANK', 'HOSPITAL'), false);
  assert.equal(canViewRoleDashboard('ADMIN', 'BLOOD_BANK'), true);
});