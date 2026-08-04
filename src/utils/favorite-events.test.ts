import test from 'node:test';
import assert from 'node:assert/strict';
import type { EventWithCreator } from '../types/database';
import {
  DEFAULT_FAVORITE_TIME_FILTER,
  filterFavoriteEvents,
  matchesFavoriteTimeFilter,
} from './favorite-events';

const now = new Date('2026-08-04T12:00:00.000Z');

const event = (id: string, startsAt: string, endsAt: string): EventWithCreator => ({
  id,
  starts_at: startsAt,
  ends_at: endsAt,
  operating_hours: null,
} as EventWithCreator);

const live = event('live', '2026-08-04T10:00:00.000Z', '2026-08-04T14:00:00.000Z');
const upcoming = event('upcoming', '2026-08-05T10:00:00.000Z', '2026-08-05T14:00:00.000Z');
const past = event('past', '2026-08-03T10:00:00.000Z', '2026-08-03T14:00:00.000Z');

test('default favorites filter keeps only live and upcoming events', () => {
  assert.equal(DEFAULT_FAVORITE_TIME_FILTER, 'active');
  assert.deepEqual(
    filterFavoriteEvents([past, upcoming, live], undefined, now).map((item) => item.id),
    ['upcoming', 'live'],
  );
});

test('individual temporal filters use the shared event status contract', () => {
  assert.equal(matchesFavoriteTimeFilter(live, 'live', now), true);
  assert.equal(matchesFavoriteTimeFilter(upcoming, 'upcoming', now), true);
  assert.equal(matchesFavoriteTimeFilter(past, 'past', now), true);
  assert.equal(matchesFavoriteTimeFilter(past, 'active', now), false);
});

test('all filter preserves every favorite', () => {
  assert.deepEqual(
    filterFavoriteEvents([past, upcoming, live], 'all', now).map((item) => item.id),
    ['past', 'upcoming', 'live'],
  );
});

