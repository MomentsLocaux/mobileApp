import test from 'node:test';
import assert from 'node:assert/strict';
import {
  consumeNotificationHref,
  hrefAfterAuthentication,
  isNotificationRoutingReady,
  markNotificationRoutingReady,
  peekNotificationHref,
  resetNotificationIntent,
  stageNotificationHref,
  suspendNotificationRouting,
} from './notification-intent';

test('a notification href waits until auth consumes it', () => {
  resetNotificationIntent();
  stageNotificationHref('/events/abc');
  assert.equal(peekNotificationHref(), '/events/abc');
  assert.equal(hrefAfterAuthentication(), '/events/abc');
  assert.equal(peekNotificationHref(), null);
  assert.equal(hrefAfterAuthentication(), '/(tabs)');
});

test('a later tap replaces the pending screen', () => {
  resetNotificationIntent();
  stageNotificationHref('/events/old');
  stageNotificationHref('/messages/conv');
  assert.equal(consumeNotificationHref(), '/messages/conv');
  assert.equal(consumeNotificationHref(), null);
});

test('routing waits until the signed-in shell is ready', () => {
  resetNotificationIntent();
  assert.equal(isNotificationRoutingReady(), false);
  stageNotificationHref('/events/abc');
  markNotificationRoutingReady();
  assert.equal(isNotificationRoutingReady(), true);
  assert.equal(hrefAfterAuthentication(), '/events/abc');
  suspendNotificationRouting();
  assert.equal(isNotificationRoutingReady(), false);
});
