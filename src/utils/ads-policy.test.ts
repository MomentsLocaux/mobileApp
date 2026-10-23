import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adSessionSize,
  canServeUnit,
  commitAdImpression,
  listAdIndexes,
  planAdRequest,
  releaseAdSlot,
  reserveAdSlot,
  resetAdSession,
} from './ads-policy';

const TEST_PUBLISHER = 'ca-app-pub-3940256099942544';

test('list ads start after the 8th event, then every 8, max 2', () => {
  assert.deepEqual(listAdIndexes(0), []);
  assert.deepEqual(listAdIndexes(7), []);
  assert.deepEqual(listAdIndexes(8), [7]);
  assert.deepEqual(listAdIndexes(15), [7]);
  assert.deepEqual(listAdIndexes(16), [7, 15]);
  assert.deepEqual(listAdIndexes(40), [7, 15]);
});

test('refusal sends nothing, including no tracking prompt', () => {
  const plan = planAdRequest(
    {
      canRequestAds: false,
      consentNotRequired: false,
      selectPersonalisedAds: false,
      usePreciseGeolocationData: false,
    },
    'ios',
  );
  assert.equal(plan.canRequest, false);
  assert.equal(plan.requestTrackingPermission, false);
  assert.equal(plan.allowPreciseLocation, false);
});

test('personalised consent may use location and asks iPhone tracking only', () => {
  const consent = {
    canRequestAds: true,
    consentNotRequired: false,
    selectPersonalisedAds: true,
    usePreciseGeolocationData: true,
  };
  const ios = planAdRequest(consent, 'ios');
  const android = planAdRequest(consent, 'android');
  assert.equal(ios.personalized, true);
  assert.equal(ios.allowPreciseLocation, true);
  assert.equal(ios.requestTrackingPermission, true);
  assert.equal(android.requestTrackingPermission, false);
});

test('managed options can keep cards without personalisation or location', () => {
  const plan = planAdRequest(
    {
      canRequestAds: true,
      consentNotRequired: false,
      selectPersonalisedAds: false,
      usePreciseGeolocationData: false,
    },
    'ios',
  );
  assert.equal(plan.canRequest, true);
  assert.equal(plan.personalized, false);
  assert.equal(plan.allowPreciseLocation, false);
  assert.equal(plan.requestTrackingPermission, false);
});

test('outside GDPR, cards can be personalised without a location purpose', () => {
  const plan = planAdRequest(
    {
      canRequestAds: true,
      consentNotRequired: true,
      selectPersonalisedAds: false,
      usePreciseGeolocationData: false,
    },
    'ios',
  );
  assert.equal(plan.personalized, true);
  assert.equal(plan.allowPreciseLocation, false);
  assert.equal(plan.requestTrackingPermission, true);
});

test('a production build refuses Google sample units', () => {
  assert.equal(canServeUnit(`${TEST_PUBLISHER}/3986624511`, true, TEST_PUBLISHER), false);
  assert.equal(canServeUnit(`${TEST_PUBLISHER}/3986624511`, false, TEST_PUBLISHER), true);
  assert.equal(canServeUnit('ca-app-pub-1/2', true, TEST_PUBLISHER), true);
  assert.equal(canServeUnit('  ', false, TEST_PUBLISHER), false);
});

test('session cap counts shown cards and frees a failed load', () => {
  resetAdSession();
  assert.equal(reserveAdSlot('home'), true);
  assert.equal(reserveAdSlot('list-7'), true);
  assert.equal(reserveAdSlot('detail-a'), true);
  assert.equal(reserveAdSlot('detail-b'), false);
  releaseAdSlot('detail-a');
  assert.equal(reserveAdSlot('detail-b'), true);
  commitAdImpression('detail-b');
  releaseAdSlot('detail-b');
  assert.equal(adSessionSize(), 3);
  assert.equal(reserveAdSlot('detail-b'), true);
  resetAdSession();
});
