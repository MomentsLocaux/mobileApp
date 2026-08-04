import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveEventTimeScope } from './event-time-scope';

describe('event time scope contract', () => {
  it('uses current events for the default browse state', () => {
    assert.equal(resolveEventTimeScope({ metaFilter: 'all' }), 'current');
  });

  it('includes past events for an applied search that requests them', () => {
    assert.equal(
      resolveEventTimeScope({
        metaFilter: 'all',
        searchActive: true,
        includePast: true,
      }),
      'all'
    );
  });

  it('keeps explicit status scopes authoritative', () => {
    assert.equal(
      resolveEventTimeScope({ metaFilter: 'live', searchActive: true, includePast: true }),
      'ongoing'
    );
    assert.equal(
      resolveEventTimeScope({ metaFilter: 'upcoming', searchActive: true, includePast: true }),
      'upcoming'
    );
    assert.equal(resolveEventTimeScope({ metaFilter: 'past' }), 'all');
  });

  it('preserves the deprecated legacy include-past behavior', () => {
    assert.equal(resolveEventTimeScope({ legacyIncludePast: true }), 'all');
  });
});
