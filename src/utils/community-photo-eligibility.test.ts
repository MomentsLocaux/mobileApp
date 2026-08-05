import assert from 'node:assert/strict';
import test from 'node:test';
import { getCommunityPhotoEligibility } from './community-photo-eligibility';

const eligibility = (overrides: Partial<Parameters<typeof getCommunityPhotoEligibility>[0]> = {}) =>
  getCommunityPhotoEligibility({
    authenticated: true,
    checkinEnabled: false,
    isOwner: false,
    isAdmin: false,
    hasCheckedIn: false,
    ...overrides,
  });

test('community photos do not require check-in while the feature is parked', () => {
  assert.deepEqual(eligibility(), { allowed: true, reason: null });
});

test('community photos require check-in when the feature is enabled', () => {
  assert.deepEqual(eligibility({ checkinEnabled: true }), {
    allowed: false,
    reason: 'checkin_required',
  });
  assert.deepEqual(eligibility({ checkinEnabled: true, hasCheckedIn: true }), {
    allowed: true,
    reason: null,
  });
});

test('owner and admin keep their existing check-in exemption', () => {
  assert.equal(eligibility({ checkinEnabled: true, isOwner: true }).allowed, true);
  assert.equal(eligibility({ checkinEnabled: true, isAdmin: true }).allowed, true);
});

test('authentication remains mandatory independently of the check-in flag', () => {
  assert.deepEqual(eligibility({ authenticated: false }), {
    allowed: false,
    reason: 'sign_in',
  });
});
