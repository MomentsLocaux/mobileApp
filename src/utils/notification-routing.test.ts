import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveNotificationRoute } from './notification-routing';

test('a change request opens the event editor, not the public page', () => {
  assert.deepEqual(
    resolveNotificationRoute('event_request_changes', { eventId: 'evt-1' }),
    { href: '/events/create?edit=evt-1' },
  );
  assert.deepEqual(
    resolveNotificationRoute('event_request_changes', { event_id: 'evt-2' }),
    { href: '/events/create?edit=evt-2' },
  );
});

test('a change request without an event id falls back to the suggestion list', () => {
  const route = resolveNotificationRoute('event_request_changes', {});
  assert.ok(
    route.href === '/profile/my-suggestions' || route.href === '/profile/my-events',
  );
});

test('another notification that carries an event id still opens the public page', () => {
  assert.deepEqual(resolveNotificationRoute('event_published', { eventId: 'evt-1' }), {
    href: '/events/evt-1',
  });
});

test('one nearby event opens its page', () => {
  assert.deepEqual(
    resolveNotificationRoute('event_nearby_new', {
      kind: 'event_nearby_digest',
      eventId: '11111111-1111-4111-8111-111111111111',
      eventIds: '11111111-1111-4111-8111-111111111111',
    }),
    { href: '/events/11111111-1111-4111-8111-111111111111' },
  );
});

test('several nearby events open the review question, not the map', () => {
  const first = '11111111-1111-4111-8111-111111111111';
  const second = '22222222-2222-4222-8222-222222222222';
  assert.deepEqual(
    resolveNotificationRoute('event_nearby_new', {
      kind: 'event_nearby_digest',
      eventIds: `${first},${second}`,
      route: 'map',
    }),
    { href: `/notifications/nearby-review?ids=${first},${second}` },
  );
});
