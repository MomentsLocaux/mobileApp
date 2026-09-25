import test from 'node:test';
import assert from 'node:assert/strict';
import type { EventWithCreator } from '../types/database';
import {
  AGENDA_BUCKET_COPY,
  buildMonthGrid,
  buildWeekDays,
  countAgendaDayActivities,
  eventOverlapsLocalDay,
  filterAgendaBucketEvents,
  formatActivityCount,
  groupAgendaEventsByDay,
  likedEventsInRange,
  resolveAgendaBucket,
  startOfWeekMonday,
  toLocalDateKey,
  visibleAgendaBuckets,
} from './agenda';

const event = (id: string, startsAt: string, endsAt: string): EventWithCreator =>
  ({
    id,
    starts_at: startsAt,
    ends_at: endsAt,
    operating_hours: null,
  }) as EventWithCreator;

const tuesday = new Date(2026, 8, 22, 12, 0, 0);
const now = new Date('2026-09-22T09:00:00.000Z');

test('month grid covers every day of the month and liked events in a range', () => {
  const grid = buildMonthGrid(new Date(2026, 8, 15));
  assert.equal(grid.length, 42);
  assert.equal(toLocalDateKey(grid[0]), '2026-08-31');
  assert.ok(grid.some((day) => toLocalDateKey(day) === '2026-09-30'));
  const concert = event('c1', '2026-09-22T17:30:00.000+02:00', '2026-09-24T19:00:00.000+02:00');
  const later = event('c2', '2026-09-28T17:30:00.000+02:00', '2026-09-28T19:00:00.000+02:00');
  const found = likedEventsInRange([later, concert], new Date(2026, 8, 22), new Date(2026, 8, 24));
  assert.deepEqual(found.map((item) => item.id), ['c1']);
});

test('week starts on Monday even when the anchor is Tuesday', () => {
  const monday = startOfWeekMonday(tuesday);
  assert.equal(toLocalDateKey(monday), '2026-09-21');
  assert.deepEqual(
    buildWeekDays(tuesday).map((day) => toLocalDateKey(day)),
    ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'],
  );
});

test('an event overlaps only the local days it actually covers', () => {
  const concert = event('c1', '2026-09-22T17:30:00.000+02:00', '2026-09-22T19:00:00.000+02:00');
  assert.equal(eventOverlapsLocalDay(concert, tuesday), true);
  assert.equal(eventOverlapsLocalDay(concert, new Date(2026, 8, 21)), false);
});

test('hearts go to interested, then past once the event has ended', () => {
  const live = event('live', '2026-09-22T10:00:00.000Z', '2026-09-22T20:00:00.000Z');
  const past = event('past', '2026-09-20T10:00:00.000Z', '2026-09-20T12:00:00.000Z');
  const sets = { interestedIds: ['live', 'past'], participatingIds: [], organizingIds: [] };
  assert.equal(resolveAgendaBucket(live, sets, now), 'interested');
  assert.equal(resolveAgendaBucket(past, sets, now), 'past');
});

test('check-in and create buckets stay hidden when flags are off', () => {
  assert.deepEqual(visibleAgendaBuckets({ checkin: false, eventCreate: false }), [
    'interested',
    'past',
  ]);
  assert.deepEqual(visibleAgendaBuckets({ checkin: true, eventCreate: true }), [
    'interested',
    'participating',
    'organizing',
    'past',
  ]);
});

test('day counter ignores past events and hidden buckets', () => {
  const heart = event('heart', '2026-09-22T10:00:00.000Z', '2026-09-22T18:00:00.000Z');
  const checkin = event('in', '2026-09-22T11:00:00.000Z', '2026-09-22T16:00:00.000Z');
  const past = event('past', '2026-09-21T10:00:00.000Z', '2026-09-21T11:00:00.000Z');
  const sets = {
    interestedIds: ['heart', 'past'],
    participatingIds: ['in'],
    organizingIds: [],
  };
  assert.equal(
    countAgendaDayActivities([heart, checkin, past], tuesday, sets, { checkin: false, eventCreate: false }, now),
    1,
  );
  assert.equal(
    countAgendaDayActivities([heart, checkin, past], tuesday, sets, { checkin: true, eventCreate: false }, now),
    2,
  );
});

test('selected-day filter applies to active buckets but not to past', () => {
  const todayHeart = event('today', '2026-09-22T10:00:00.000Z', '2026-09-22T18:00:00.000Z');
  const laterHeart = event('later', '2026-09-26T10:00:00.000Z', '2026-09-26T12:00:00.000Z');
  const pastHeart = event('past', '2026-09-10T10:00:00.000Z', '2026-09-10T12:00:00.000Z');
  const sets = {
    interestedIds: ['today', 'later', 'past'],
    participatingIds: [],
    organizingIds: [],
  };
  assert.deepEqual(
    filterAgendaBucketEvents([todayHeart, laterHeart, pastHeart], 'interested', sets, {
      day: tuesday,
      now,
    }).map((item) => item.id),
    ['today'],
  );
  assert.deepEqual(
    filterAgendaBucketEvents([todayHeart, laterHeart, pastHeart], 'past', sets, {
      day: tuesday,
      now,
    }).map((item) => item.id),
    ['past'],
  );
});

test('lists group by calendar day with a french heading', () => {
  const first = event('a', '2026-09-22T10:00:00.000+02:00', '2026-09-22T12:00:00.000+02:00');
  const second = event('b', '2026-09-26T17:30:00.000+02:00', '2026-09-26T19:00:00.000+02:00');
  const groups = groupAgendaEventsByDay([second, first]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0]?.key, '2026-09-22');
  assert.match(groups[0]?.label || '', /22/);
  assert.equal(formatActivityCount(0), '0 activités');
  assert.equal(AGENDA_BUCKET_COPY.interested.title.includes('intéressé'), true);
});
