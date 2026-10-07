import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANALYTICS_EVENT_NAMES,
  createAnalyticsId,
  enqueueAnalyticsEvent,
  homeReasonCode,
  sanitizeAnalyticsProps,
  takeAnalyticsBatch,
  type QueuedAnalyticsEvent,
} from './analytics-events';

const queued = (id: string): QueuedAnalyticsEvent => ({
  client_event_id: id,
  session_id: '11111111-1111-4111-8111-111111111111',
  name: 'app_opened',
  props: { platform: 'ios', version: '1.0.0' },
  created_at: '2026-10-07T10:00:00.000Z',
});

test('the twelve engagement events are the only names', () => {
  assert.equal(ANALYTICS_EVENT_NAMES.length, 12);
  assert.equal(sanitizeAnalyticsProps('app_opened', { platform: 'ios', version: '1.0.0', email: 'a@b.c' })?.email, undefined);
});

test('props reject free text, emails, and unknown keys', () => {
  assert.equal(sanitizeAnalyticsProps('event_viewed', { event_id: 'not-a-uuid', source: 'detail' }), null);
  assert.deepEqual(
    sanitizeAnalyticsProps('notification_opened', { type: 'system', body: 'Bonjour Camille' } as never),
    { type: 'system' },
  );
  assert.deepEqual(sanitizeAnalyticsProps('search_performed', {
    has_where: true,
    has_when: false,
    has_category: true,
  }), { has_where: true, has_when: false, has_category: true });
});

test('home reasons become codes, never the sentence', () => {
  assert.equal(homeReasonCode('En ce moment'), 'live');
  assert.equal(homeReasonCode('Dans 12 min'), 'soon');
  assert.equal(homeReasonCode('Camille'), 'none');
});

test('a failed flush keeps the queue and does not duplicate a client id', () => {
  const id = createAnalyticsId();
  const once = enqueueAnalyticsEvent([], queued(id));
  const twice = enqueueAnalyticsEvent(once, queued(id));
  assert.equal(twice.length, 1);
  const { batch, rest } = takeAnalyticsBatch(twice, 20);
  assert.equal(batch.length, 1);
  assert.equal(rest.length, 0);
});
