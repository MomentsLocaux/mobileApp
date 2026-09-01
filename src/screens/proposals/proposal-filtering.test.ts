import test from 'node:test';
import assert from 'node:assert/strict';
import type { EventWithCreator } from '@/types/database';
import { filterProposalPool, getProposalDateRange, resolveProposalCandidateRequest, resolveProposalViewportRequest, selectProposalDeck, uniqueProposalUuids } from './proposal-filtering';
import type { ProposalPreferences } from './proposal.types';

const now = new Date('2026-08-04T12:00:00.000Z');
const preferences: ProposalPreferences = {
  categoryIds: ['music-id'],
  radiusKm: 25,
  anchor: { latitude: 48.8566, longitude: 2.3522, label: 'Paris' },
  dateWindow: '7_days',
};

function event(overrides: Partial<EventWithCreator>): EventWithCreator {
  return {
    id: 'event-default',
    title: 'Moment local',
    category: 'music',
    starts_at: '2026-08-05T18:00:00.000Z',
    ends_at: '2026-08-05T20:00:00.000Z',
    latitude: 48.86,
    longitude: 2.35,
    status: 'published',
    visibility: 'public',
    operating_hours: null,
    ...overrides,
  } as EventWithCreator;
}

test('7-day range covers today through the sixth following day', () => {
  const range = getProposalDateRange('7_days', now);
  assert.ok(range);
  assert.equal(range.start.getHours(), 0);
  assert.equal(range.start.getMinutes(), 0);
  assert.equal(range.end.getDate() - range.start.getDate(), 6);
  assert.equal(range.end.getHours(), 23);
  assert.equal(range.end.getMinutes(), 59);
});

test('custom range uses inclusive local start and end dates', () => {
  const range = getProposalDateRange('custom', now, {
    startDate: '2026-08-10',
    endDate: '2026-08-12',
  });
  assert.ok(range);
  assert.equal(range.start.getFullYear(), 2026);
  assert.equal(range.start.getMonth(), 7);
  assert.equal(range.start.getDate(), 10);
  assert.equal(range.start.getHours(), 0);
  assert.equal(range.end.getDate(), 12);
  assert.equal(range.end.getHours(), 23);
});

test('custom range with only a start date is a single day', () => {
  const range = getProposalDateRange('custom', now, { startDate: '2026-08-10', endDate: null });
  assert.ok(range);
  assert.equal(range.start.getDate(), 10);
  assert.equal(range.end.getDate(), 10);
});

test('custom window without dates yields an empty pool', () => {
  const result = filterProposalPool({
    events: [event({ id: 'valid' })],
    preferences: { ...preferences, dateWindow: 'custom', customStartDate: null, customEndDate: null },
    categoryValues: ['music'],
    now,
  });
  assert.deepEqual(result.map((item) => item.id), []);
});

test('viewport fetch uses current+merge for a future custom window', () => {
  const request = resolveProposalViewportRequest(
    {
      dateWindow: 'custom',
      customStartDate: '2026-08-20',
      customEndDate: '2026-08-22',
    },
    now,
  );
  assert.equal(request.timeScope, 'current');
  assert.equal(request.mergeUpcoming, true);
  assert.ok(request.limit >= 1500);
  assert.ok(request.dateRange);
  assert.equal(request.dateRange.start.getDate(), 20);
  assert.equal(request.dateRange.end.getDate(), 22);
});

test('viewport fetch uses all when the custom window is in the past', () => {
  const request = resolveProposalViewportRequest(
    {
      dateWindow: 'custom',
      customStartDate: '2026-07-01',
      customEndDate: '2026-07-03',
    },
    now,
  );
  assert.equal(request.timeScope, 'all');
  assert.equal(request.mergeUpcoming, false);
});

test('today and 7-day windows merge upcoming instead of fetching current only', () => {
  const today = resolveProposalViewportRequest({ dateWindow: 'today' }, now);
  assert.equal(today.timeScope, 'current');
  assert.equal(today.mergeUpcoming, true);

  const week = resolveProposalViewportRequest({ dateWindow: '7_days' }, now);
  assert.equal(week.timeScope, 'current');
  assert.equal(week.mergeUpcoming, true);
});

test('weekend later this week is fetched as current with upcoming merge', () => {
  const wednesday = new Date('2026-08-05T12:00:00.000Z');
  const request = resolveProposalViewportRequest({ dateWindow: 'weekend' }, wednesday);
  assert.equal(request.timeScope, 'current');
  assert.equal(request.mergeUpcoming, true);
  assert.ok(request.dateRange);
  assert.equal(request.dateRange.start.getDay(), 6);
});

test('incomplete custom window skips the viewport fetch', () => {
  const request = resolveProposalViewportRequest(
    { dateWindow: 'custom', customStartDate: null, customEndDate: null },
    now,
  );
  assert.equal(request.dateRange, null);
  assert.equal(request.mergeUpcoming, false);
});

test('custom window keeps events overlapping the chosen dates', () => {
  const inside = event({
    id: 'inside',
    starts_at: '2026-08-11T18:00:00.000Z',
    ends_at: '2026-08-11T20:00:00.000Z',
  });
  const outside = event({
    id: 'outside',
    starts_at: '2026-09-02T18:00:00.000Z',
    ends_at: '2026-09-02T20:00:00.000Z',
  });
  const result = filterProposalPool({
    events: [inside, outside],
    preferences: {
      ...preferences,
      dateWindow: 'custom',
      customStartDate: '2026-08-10',
      customEndDate: '2026-08-12',
    },
    categoryValues: ['music'],
    now,
  });
  assert.deepEqual(result.map((item) => item.id), ['inside']);
});

test('pool enforces publication, categories, radius, dates and exclusions', () => {
  const valid = event({ id: 'valid' });
  const outsideRadius = event({ id: 'far', latitude: 49.2 });
  const wrongCategory = event({ id: 'sports', category: 'sports' });
  const unpublished = event({ id: 'draft', status: 'draft' });
  const outsideWindow = event({
    id: 'later',
    starts_at: '2026-09-02T18:00:00.000Z',
    ends_at: '2026-09-02T20:00:00.000Z',
  });
  const excluded = event({ id: 'excluded' });
  const alreadyLiked = event({ id: 'liked', is_liked: true });
  const alreadyFavorited = event({ id: 'favorited', is_favorited: true });

  const result = filterProposalPool({
    events: [
      outsideRadius,
      wrongCategory,
      unpublished,
      outsideWindow,
      excluded,
      alreadyLiked,
      alreadyFavorited,
      valid,
    ],
    preferences,
    categoryValues: ['music-id', 'music'],
    excludedIds: ['excluded'],
    now,
  });

  assert.deepEqual(result.map((item) => item.id), ['valid']);
});

test('a 2 September concert is not proposed for a 28 September day', () => {
  const early = event({
    id: 'sept-2',
    starts_at: '2026-09-02T18:00:00.000Z',
    ends_at: '2026-09-02T21:00:00.000Z',
    operating_hours: ['Le mercredi 28 septembre 2026 de 18:00 a 21:00'],
  });
  const onDay = event({
    id: 'sept-28',
    starts_at: '2026-09-28T18:00:00.000Z',
    ends_at: '2026-09-28T21:00:00.000Z',
  });
  const festival = event({
    id: 'festival',
    starts_at: '2026-09-01T10:00:00.000Z',
    ends_at: '2026-09-30T22:00:00.000Z',
  });
  const result = filterProposalPool({
    events: [early, onDay, festival],
    preferences: {
      ...preferences,
      dateWindow: 'custom',
      customStartDate: '2026-09-28',
      customEndDate: '2026-09-28',
    },
    categoryValues: ['music'],
    now: new Date('2026-09-01T12:00:00.000Z'),
  });
  assert.deepEqual(result.map((item) => item.id).sort(), ['festival', 'sept-28']);
});

test('pool filter keeps every match and the deck is shuffled then capped at 20', () => {
  const events = Array.from({ length: 24 }, (_, index) =>
    event({
      id: `event-${index}`,
      latitude: 48.8566 + (24 - index) * 0.001,
    }),
  );
  const filtered = filterProposalPool({ events, preferences, categoryValues: ['music'], now });
  assert.equal(filtered.length, 24);

  const low = selectProposalDeck(filtered, () => 0).map((item) => item.id);
  const high = selectProposalDeck(filtered, () => 0.99).map((item) => item.id);
  assert.equal(low.length, 20);
  assert.equal(new Set(low).size, 20);
  assert.notDeepEqual(low, high);
});

test('candidate RPC request uses the circle, custom window and uuid exclusions', () => {
  const range = getProposalDateRange('custom', now, {
    startDate: '2026-09-28',
    endDate: '2026-09-28',
  });
  const request = resolveProposalCandidateRequest({
    preferences: {
      ...preferences,
      categoryIds: ['22222222-2222-4222-8222-222222222222', 'music-id'],
      dateWindow: 'custom',
      customStartDate: '2026-09-28',
      customEndDate: '2026-09-28',
    },
    excludedIds: [
      '11111111-1111-4111-8111-111111111111',
      'not-a-uuid',
      '11111111-1111-4111-8111-111111111111',
    ],
    now,
  });
  assert.ok(request);
  assert.ok(range);
  assert.equal(request.latitude, preferences.anchor?.latitude);
  assert.equal(request.radiusKm, 25);
  assert.equal(request.limit, 80);
  assert.deepEqual(request.categoryIds, ['22222222-2222-4222-8222-222222222222']);
  assert.deepEqual(request.excludeIds, ['11111111-1111-4111-8111-111111111111']);
  assert.equal(request.windowStart, range.start.toISOString());
  assert.equal(request.windowEnd, range.end.toISOString());
});

test('candidate RPC request is skipped without a complete custom window', () => {
  const request = resolveProposalCandidateRequest({
    preferences: { ...preferences, dateWindow: 'custom', customStartDate: null, customEndDate: null },
    now,
  });
  assert.equal(request, null);
});

test('only RFC uuid values are forwarded to the proposal RPC', () => {
  assert.deepEqual(uniqueProposalUuids(['abc', '11111111-1111-4111-8111-111111111111', '']), [
    '11111111-1111-4111-8111-111111111111',
  ]);
});
