import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldFetchEventViewsFallback } from './event-card-stats-plan';

describe('shouldFetchEventViewsFallback', () => {
  it('skips the second views RPC when public stats already succeeded', () => {
    assert.equal(shouldFetchEventViewsFallback(null), false);
    assert.equal(shouldFetchEventViewsFallback(undefined), false);
  });

  it('keeps get_event_views_counts as a fallback when public stats fail', () => {
    assert.equal(shouldFetchEventViewsFallback({ message: 'timeout' }), true);
  });
});
