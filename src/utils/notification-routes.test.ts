import test from 'node:test';
import assert from 'node:assert/strict';
import { hrefForNotificationDestination } from './notification-routes';

test('welcome campaign opens the map', () => {
  assert.equal(
    hrefForNotificationDestination({ campaign: 'welcome_2026_10', kind: 'welcome' }),
    '/(tabs)/map',
  );
  assert.equal(hrefForNotificationDestination({ route: 'welcome' }), '/(tabs)/map');
});

test('named routes open settings, proposals, and the other allowlisted screens', () => {
  assert.equal(hrefForNotificationDestination({ route: 'settings' }), '/settings');
  assert.equal(hrefForNotificationDestination({ route: 'proposals' }), '/(tabs)/proposals');
  assert.equal(hrefForNotificationDestination({ route: 'agenda' }), '/agenda');
  assert.equal(hrefForNotificationDestination({ route: 'messages' }), '/messages');
  assert.equal(hrefForNotificationDestination({ screen: 'favorites' }), '/(tabs)/favorites');
});

test('an explicit route wins over kind, and unknown values stay closed', () => {
  assert.equal(
    hrefForNotificationDestination({ route: 'settings', kind: 'welcome' }),
    '/settings',
  );
  assert.equal(hrefForNotificationDestination({ route: 'https://example.com' }), null);
  assert.equal(hrefForNotificationDestination({ kind: 'notification_digest' }), null);
  assert.equal(hrefForNotificationDestination(null), null);
});
