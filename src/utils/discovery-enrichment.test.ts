import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DISCOVERY_STATS_IMMEDIATE_LIMIT,
  splitDiscoveryEnrichmentIds,
} from './discovery-enrichment';

describe('splitDiscoveryEnrichmentIds', () => {
  it('loads spotlight and the first visible rows before the rest of the window', () => {
    const windowIds = Array.from({ length: 50 }, (_, index) => `e${index + 1}`);
    const { immediate, deferred } = splitDiscoveryEnrichmentIds({
      windowIds,
      spotlightIds: ['spot-a', 'spot-b', 'e1'],
    });
    assert.deepEqual(immediate.slice(0, 2), ['spot-a', 'spot-b']);
    assert.equal(immediate.includes('e1'), true);
    assert.equal(immediate.length, DISCOVERY_STATS_IMMEDIATE_LIMIT);
    assert.equal(deferred.length, 50 - (immediate.length - 2));
    assert.equal(deferred.includes('e1'), false);
    assert.equal(deferred.includes('spot-a'), false);
  });

  it('keeps spotlight even when it exceeds the immediate cap', () => {
    const { immediate, deferred } = splitDiscoveryEnrichmentIds({
      windowIds: ['a', 'b'],
      spotlightIds: ['s1', 's2', 's3'],
      immediateLimit: 2,
    });
    assert.deepEqual(immediate, ['s1', 's2', 's3']);
    assert.deepEqual(deferred, ['a', 'b']);
  });
});
