import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EventWithCreator } from '../types/database';
import { classifyEventSpan, eventMatchesDuration } from './event-duration';

const event = (
  startsAt: string,
  endsAt: string | null,
  operatingHours: unknown = null
): EventWithCreator =>
  ({
    starts_at: startsAt,
    ends_at: endsAt,
    operating_hours: operatingHours,
    schedule_mode: operatingHours ? 'recurrent' : 'ponctuel',
  }) as unknown as EventWithCreator;

describe('event span duration', () => {
  it('treats a same-day event as exceptional only', () => {
    const sameDay = event('2026-10-02T10:00:00+02:00', '2026-10-02T23:00:00+02:00');
    assert.equal(classifyEventSpan(sameDay), 'exceptional');
    assert.equal(eventMatchesDuration(sameDay, ['exceptional']), true);
    assert.equal(eventMatchesDuration(sameDay, ['short']), false);
    assert.equal(eventMatchesDuration(sameDay, ['long']), false);
  });

  it('includes the 3-day boundary in exceptional only', () => {
    const threeDays = event('2026-10-02T18:00:00+02:00', '2026-10-04T22:00:00+02:00');
    assert.equal(classifyEventSpan(threeDays), 'exceptional');
    assert.equal(eventMatchesDuration(threeDays, ['exceptional']), true);
    assert.equal(eventMatchesDuration(threeDays, ['short']), false);
  });

  it('classifies day 4 as short only', () => {
    const fourDays = event('2026-10-01T10:00:00+02:00', '2026-10-04T10:00:00+02:00');
    assert.equal(classifyEventSpan(fourDays), 'short');
    assert.equal(eventMatchesDuration(fourDays, ['exceptional']), false);
    assert.equal(eventMatchesDuration(fourDays, ['short']), true);
    assert.equal(eventMatchesDuration(fourDays, ['long']), false);
  });

  it('includes the 14-day boundary in short and classifies day 15 as long', () => {
    const fourteen = event('2026-10-01T08:00:00+02:00', '2026-10-14T20:00:00+02:00');
    const fifteen = event('2026-10-01T08:00:00+02:00', '2026-10-15T08:00:00+02:00');
    assert.equal(classifyEventSpan(fourteen), 'short');
    assert.equal(eventMatchesDuration(fourteen, ['short']), true);
    assert.equal(eventMatchesDuration(fourteen, ['long']), false);
    assert.equal(classifyEventSpan(fifteen), 'long');
    assert.equal(eventMatchesDuration(fifteen, ['long']), true);
    assert.equal(eventMatchesDuration(fifteen, ['short']), false);
  });

  it('keeps only the selected categories when several are chosen', () => {
    const exceptional = event('2026-10-02T10:00:00+02:00', '2026-10-02T18:00:00+02:00');
    const short = event('2026-10-01T10:00:00+02:00', '2026-10-08T10:00:00+02:00');
    const long = event('2026-10-01T10:00:00+02:00', '2026-11-01T10:00:00+02:00');
    const selected = ['short', 'long'] as const;

    assert.equal(eventMatchesDuration(exceptional, selected), false);
    assert.equal(eventMatchesDuration(short, selected), true);
    assert.equal(eventMatchesDuration(long, selected), true);
    assert.equal(eventMatchesDuration(exceptional, ['exceptional', 'short']), true);
    assert.equal(eventMatchesDuration(long, []), true);
  });

  it('counts calendar days across a DST change', () => {
    const overnight = event('2026-10-24T23:30:00+02:00', '2026-10-25T02:30:00+01:00');
    assert.equal(classifyEventSpan(overnight), 'exceptional');
  });

  it('uses the publication span for recurring schedules', () => {
    const exhibition = event(
      '2026-10-01T00:00:00+02:00',
      '2027-03-31T23:59:00+02:00',
      [{ kind: 'fixed', open_days: [2, 4], slots: [{ opens: '10:00', closes: '12:00' }] }]
    );
    assert.equal(classifyEventSpan(exhibition), 'long');
    assert.equal(eventMatchesDuration(exhibition, ['long']), true);
    assert.equal(eventMatchesDuration(exhibition, ['short']), false);
  });

  it('keeps missing and reversed bounds under all only', () => {
    const missing = event('2026-10-02T10:00:00+02:00', null);
    const reversed = event('2026-10-02T10:00:00+02:00', '2026-10-02T09:00:00+02:00');

    for (const value of [missing, reversed]) {
      assert.equal(classifyEventSpan(value), 'unknown');
      assert.equal(eventMatchesDuration(value, []), true);
      assert.equal(eventMatchesDuration(value, ['exceptional']), false);
      assert.equal(eventMatchesDuration(value, ['short']), false);
      assert.equal(eventMatchesDuration(value, ['long']), false);
      assert.equal(eventMatchesDuration(value, ['exceptional', 'short', 'long']), false);
    }
  });
});
