import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getVisibleEventTags, isHiddenDiscoveryTag } from './event-card-display';

describe('visible event tags', () => {
  it('strips provenance and operational slugs', () => {
    assert.equal(isHiddenDiscoveryTag('openagenda_api_123'), true);
    assert.equal(isHiddenDiscoveryTag('needs_review'), true);
    assert.equal(isHiddenDiscoveryTag('jazz'), false);
    assert.deepEqual(
      getVisibleEventTags(['openagenda_api', 'needs_category', 'jazz', 'vide_grenier', '1']),
      ['jazz', 'vide_grenier'],
    );
  });
});
