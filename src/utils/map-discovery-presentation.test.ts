import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { EventWithCreator } from '../types/database';
import { selectMapSpotlight, mapEventDateHeading, estimateMapEventOffset } from './map-discovery-presentation';

const event = (id: string, overrides: Partial<EventWithCreator> = {}) => ({
  id, title: id, status: 'published', starts_at: '2026-09-26T12:00:00Z', likes_count: 0,
  ...overrides,
} as EventWithCreator);

describe('map discovery presentation', () => {
  it('keeps Spotlight within the filtered supply, unique and published, without mutating it', () => {
    const input = [event('a'), event('b', { status: 'draft' }), event('a'), event('c'), event('d'), event('e')];
    const before = [...input];
    const result = selectMapSpotlight(input);
    assert.equal(result.length, 3);
    assert.equal(new Set(result.map((item) => item.id)).size, 3);
    assert.ok(result.every((item) => item.status === 'published' && input.includes(item)));
    assert.deepEqual(input, before);
    assert.deepEqual(selectMapSpotlight([]), []);
  });
  it('puts the most liked events first in Lumia recommendations', () => {
    const input = [
      event('quiet', { likes_count: 1 }),
      event('loved', { likes_count: 12 }),
      event('warm', { likes_count: 4 }),
    ];
    assert.deepEqual(selectMapSpotlight(input).map((item) => item.id), ['loved', 'warm', 'quiet']);
    assert.deepEqual(
      selectMapSpotlight(input, null, { quiet: 20, loved: 3 }).map((item) => item.id),
      ['quiet', 'warm', 'loved'],
    );
  });
  it('keeps relevance, distance and newest orders free of misleading date groupings', () => {
    for (const sort of ['triage', 'distance', 'created', 'popularity', 'endDate'] as const) {
      assert.equal(mapEventDateHeading(event('a'), undefined, sort), null);
    }
  });
  it('starts each local date once, including across pagination, and handles unknown dates', () => {
    const first = event('a');
    const sameDay = event('b', { starts_at: '2026-09-26T13:00:00Z' });
    const nextDay = event('c', { starts_at: '2026-09-27T13:00:00Z' });
    assert.match(mapEventDateHeading(first, undefined, 'date')!, /26 septembre 2026/);
    assert.equal(mapEventDateHeading(sameDay, first, 'date'), null);
    assert.match(mapEventDateHeading(nextDay, sameDay, 'date')!, /27 septembre 2026/);
    assert.equal(mapEventDateHeading(event('d', { starts_at: '' }), nextDay, 'date'), 'Date à confirmer');
    assert.equal(mapEventDateHeading(event('e', { starts_at: '' }), event('d', { starts_at: '' }), 'date'), null);
  });
  it('includes the measured Spotlight/invitation header when estimating a distant row', () => {
    assert.equal(estimateMapEventOffset(80, 200, 640), 16640);
    assert.equal(estimateMapEventOffset(0, 200, 640), 640);
    assert.equal(estimateMapEventOffset(1, 0, 640), 860);
    assert.equal(estimateMapEventOffset(-1, 0, -10), 0);
  });
});
