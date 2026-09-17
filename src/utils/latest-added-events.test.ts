import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EventWithCreator } from '../types/database';
import { takeLatestCreatedEvents } from './latest-added-events';

const event = (id: string, createdAt: string): EventWithCreator =>
  ({ id, title: id, created_at: createdAt }) as EventWithCreator;

describe('takeLatestCreatedEvents', () => {
  it('returns the newest created_at first without mutating the input', () => {
    const older = event('older', '2026-09-01T10:00:00.000Z');
    const newer = event('newer', '2026-09-16T10:00:00.000Z');
    const input = [older, newer];
    assert.deepEqual(
      takeLatestCreatedEvents(input, 10).map((item) => item.id),
      ['newer', 'older'],
    );
    assert.deepEqual(input.map((item) => item.id), ['older', 'newer']);
  });

  it('caps the carousel length', () => {
    const events = [
      event('a', '2026-09-10T10:00:00.000Z'),
      event('b', '2026-09-11T10:00:00.000Z'),
      event('c', '2026-09-12T10:00:00.000Z'),
    ];
    assert.deepEqual(
      takeLatestCreatedEvents(events, 2).map((item) => item.id),
      ['c', 'b'],
    );
  });
});
