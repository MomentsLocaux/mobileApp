import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleDraftFromDateRange } from './event-schedule';

test('a single poster day opens the simple start/end time editor', () => {
  const draft = scheduleDraftFromDateRange('2026-09-12T17:00:00.000Z', '2026-09-12T21:00:00.000Z');
  assert.equal(draft.scheduleMode, 'single_day');
  assert.equal(draft.startDate, '2026-09-12T17:00:00.000Z');
  assert.equal(draft.endDate, '2026-09-12T21:00:00.000Z');
});

test('a multi-day poster window opens the particular-hours planner', () => {
  const draft = scheduleDraftFromDateRange('2026-09-12T17:00:00.000Z', '2026-09-14T22:00:00.000Z');
  assert.equal(draft.scheduleMode, 'fixed');
  assert.ok(draft.scheduleFixedSlots.length >= 1);
  assert.deepEqual(draft.scheduleOpenDays, [1, 6, 7]);
});

test('an inverted start/end window is bumped so the planner stays valid', () => {
  const draft = scheduleDraftFromDateRange('2026-09-12T19:00:00.000Z', '2026-09-12T18:00:00.000Z');
  assert.ok(draft.endDate);
  assert.ok(new Date(draft.endDate as string) > new Date(draft.startDate as string));
});

test('a start date without an end date still gets an editable window', () => {
  const draft = scheduleDraftFromDateRange('2026-09-12T12:00:00.000Z');
  assert.ok(draft.endDate);
});
