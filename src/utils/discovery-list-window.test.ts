import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DISCOVERY_LIST_PAGE_SIZE,
  discoveryListOrderKey,
  formatDiscoveryResultCount,
  nextDiscoveryListWindowCount,
  resolveDiscoveryListWindowCount,
  shouldPrefetchNextDiscoveryPage,
  windowCountToIncludeIndex,
} from './discovery-list-window';

describe('discovery list window', () => {
  it('shows the full list when it fits on the first page', () => {
    assert.equal(
      resolveDiscoveryListWindowCount({ totalCount: 12, revealedCount: 50 }),
      12
    );
    assert.equal(
      nextDiscoveryListWindowCount({ totalCount: 12, revealedCount: 12 }),
      12
    );
  });

  it('opens on the first 50 of an already-sorted set', () => {
    assert.equal(
      resolveDiscoveryListWindowCount({ totalCount: 187, revealedCount: 0 }),
      DISCOVERY_LIST_PAGE_SIZE
    );
    assert.equal(
      nextDiscoveryListWindowCount({ totalCount: 187, revealedCount: 50 }),
      100
    );
    assert.equal(
      nextDiscoveryListWindowCount({ totalCount: 187, revealedCount: 150 }),
      187
    );
  });

  it('prefetches the next page near the end of the current window, not at item 0', () => {
    assert.equal(
      shouldPrefetchNextDiscoveryPage({
        totalCount: 187,
        revealedCount: 50,
        highestViewedIndex: 12,
      }),
      false
    );
    assert.equal(
      shouldPrefetchNextDiscoveryPage({
        totalCount: 187,
        revealedCount: 50,
        highestViewedIndex: 40,
      }),
      true
    );
    assert.equal(
      shouldPrefetchNextDiscoveryPage({
        totalCount: 40,
        revealedCount: 40,
        highestViewedIndex: 39,
      }),
      false
    );
  });

  it('changes the order key when sort reorders the same ids', () => {
    const nearby = ['a', 'b', 'c'];
    const popular = ['c', 'a', 'b'];
    assert.notEqual(discoveryListOrderKey(nearby), discoveryListOrderKey(popular));
    assert.equal(discoveryListOrderKey(nearby), discoveryListOrderKey(['a', 'b', 'c']));
  });

  it('expands the window far enough to include a map-highlighted row', () => {
    assert.equal(windowCountToIncludeIndex(0), 50);
    assert.equal(windowCountToIncludeIndex(49), 50);
    assert.equal(windowCountToIncludeIndex(50), 100);
    assert.equal(windowCountToIncludeIndex(87), 100);
  });

  it('keeps the total wording independent from the visible window', () => {
    assert.equal(formatDiscoveryResultCount(1), '1 événement');
    assert.equal(formatDiscoveryResultCount(187), '187 événements');
  });
});
