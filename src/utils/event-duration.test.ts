import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EventWithCreator } from '../types/database';
import { eventMatchesDuration, normalizeDurationBucket } from './event-duration';
import { hydrateDurationBuckets } from './event-duration-hydration';

describe('server duration bucket', () => {
  it('uses the stored bucket even when local dates suggest another duration', () => {
    const event = { starts_at: '2026-10-01T10:00:00Z', ends_at: '2026-10-01T11:00:00Z', duration_bucket: 'long' } as EventWithCreator;
    assert.equal(eventMatchesDuration(event, ['long']), true);
    assert.equal(eventMatchesDuration(event, ['exceptional']), false);
    assert.equal(eventMatchesDuration(event, ['short', 'long']), true);
  });
  it('does not access dates or schedules when filtering', () => {
    const event = { duration_bucket: 'short', get starts_at() { throw new Error('no date calculation'); }, get ends_at() { throw new Error('no date calculation'); } } as unknown as EventWithCreator;
    assert.equal(eventMatchesDuration(event, ['short']), true);
    assert.equal(eventMatchesDuration(event, ['long']), false);
  });
  it('keeps unknown, absent and invalid buckets only without a duration filter', () => {
    for (const bucket of [undefined, null, '', 'unknown', 'SHORT', 3]) {
      const event = { duration_bucket: bucket } as EventWithCreator;
      assert.equal(normalizeDurationBucket(bucket), null);
      assert.equal(eventMatchesDuration(event, []), true);
      assert.equal(eventMatchesDuration(event, undefined), true);
      assert.equal(eventMatchesDuration(event, ['exceptional', 'short', 'long']), false);
    }
  });
  it('matches each bucket exclusively and allows unions', () => {
    for (const bucket of ['exceptional', 'short', 'long'] as const) {
      assert.equal(eventMatchesDuration({ duration_bucket: bucket }, [bucket]), true);
      assert.equal(eventMatchesDuration({ duration_bucket: bucket }, []), true);
      const others = (['exceptional', 'short', 'long'] as const).filter(value => value !== bucket);
      assert.equal(eventMatchesDuration({ duration_bucket: bucket }, others), false);
    }
  });
});

describe('duration bucket RPC hydration', () => {
  it('fetches missing fields once, preserves order and explicit null, and never mutates input', async () => {
    const rows = [{ id: 'a' }, { id: 'b', duration_bucket: null }, { id: 'a' }, { id: 'c', duration_bucket: 'short' }];
    const calls: string[][] = [];
    const result = await hydrateDurationBuckets(rows, async ids => {
      calls.push(ids);
      return [{ id: 'a', duration_bucket: 'long' }];
    });
    assert.deepEqual(calls, [['a']]);
    assert.deepEqual(result.map(row => row.duration_bucket), ['long', null, 'long', 'short']);
    assert.equal(rows[0].duration_bucket, undefined);
    assert.deepEqual(result.map(row => row.id), ['a', 'b', 'a', 'c']);
  });
  it('avoids extra requests when the RPC already returns the column', async () => {
    const fetch = async () => { throw new Error('unexpected fetch'); };
    assert.deepEqual(await hydrateDurationBuckets([], fetch), []);
    assert.deepEqual(await hydrateDurationBuckets([{ id: 'a', duration_bucket: 'exceptional' }], fetch), [{ id: 'a', duration_bucket: 'exceptional' }]);
  });
  it('bounds requests and treats inaccessible rows as unknown', async () => {
    const rows = Array.from({ length: 401 }, (_, id) => ({ id: String(id) }));
    const sizes: number[] = [];
    const result = await hydrateDurationBuckets(rows, async ids => { sizes.push(ids.length); return []; });
    assert.deepEqual(sizes, [200, 200, 1]);
    assert.ok(result.every(row => row.duration_bucket === null));
  });
  it('propagates failure instead of returning an apparently complete unfiltered response', async () => {
    await assert.rejects(hydrateDurationBuckets([{ id: 'a' }], async () => { throw new Error('network'); }), /network/);
  });
});
