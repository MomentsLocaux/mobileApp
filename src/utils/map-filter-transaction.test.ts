import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveViewportRefreshAfterFilter } from './map-filter-transaction';

describe('map filter transaction', () => {
  it('refreshes viewport when client reapply cannot satisfy the change', () => {
    assert.equal(
      resolveViewportRefreshAfterFilter({
        reapplied: false,
        metaFilter: 'live',
      }),
      true
    );
  });

  it('refreshes viewport when entering or leaving past meta filter', () => {
    assert.equal(
      resolveViewportRefreshAfterFilter({
        reapplied: true,
        metaFilter: 'past',
      }),
      true
    );
    assert.equal(
      resolveViewportRefreshAfterFilter({
        reapplied: true,
        metaFilter: 'live',
        previousMetaFilter: 'past',
      }),
      true
    );
  });

  it('keeps cached payload when client reapply succeeded', () => {
    assert.equal(
      resolveViewportRefreshAfterFilter({
        reapplied: true,
        metaFilter: 'live',
      }),
      false
    );
  });

  it('forces a server refresh when a date transition changes the required payload', () => {
    assert.equal(
      resolveViewportRefreshAfterFilter({
        reapplied: true,
        metaFilter: 'all',
        forceRefresh: true,
      }),
      true
    );
  });

  it('refreshes when browse status chips change the RPC time scope', () => {
    assert.equal(
      resolveViewportRefreshAfterFilter({
        reapplied: true,
        metaFilter: 'upcoming',
        previousMetaFilter: 'live',
      }),
      true
    );
    assert.equal(
      resolveViewportRefreshAfterFilter({
        reapplied: true,
        metaFilter: 'all',
        previousMetaFilter: 'live',
      }),
      true
    );
  });
});
