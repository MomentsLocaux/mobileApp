import test from 'node:test';
import assert from 'node:assert/strict';
import type { EventWithCreator } from '@/types/database';
import { filterProposalPool, getProposalDateRange } from './proposal-filtering';
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

test('pool is limited to 20 and ordered nearest first', () => {
  const events = Array.from({ length: 24 }, (_, index) =>
    event({
      id: `event-${index}`,
      latitude: 48.8566 + (24 - index) * 0.001,
    }),
  );
  const result = filterProposalPool({ events, preferences, categoryValues: ['music'], now });

  assert.equal(result.length, 20);
  assert.equal(result[0].id, 'event-23');
});
