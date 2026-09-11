import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatResolvedEventTagLabel,
  getVisibleEventTags,
  isHiddenDiscoveryTag,
  isInternalTagId,
} from './event-card-display';

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

  it('hides unresolved taxonomy ids', () => {
    const tagId = '16ea211a-c962-4cf9-96d0-ab28447991f4';
    assert.equal(isInternalTagId(tagId), true);
    assert.equal(isHiddenDiscoveryTag(tagId), true);
    assert.deepEqual(getVisibleEventTags(['jazz', tagId]), ['jazz']);
  });

  it('resolves taxonomy ids to slugs when a lookup is provided', () => {
    const tagId = '16ea211a-c962-4cf9-96d0-ab28447991f4';
    assert.deepEqual(
      getVisibleEventTags(['jazz', tagId], {
        [tagId]: { slug: 'famille', label: 'Famille' },
      }),
      ['jazz', 'famille'],
    );
  });

  it('prefers taxonomy labels over raw slugs', () => {
    assert.equal(
      formatResolvedEventTagLabel('vide_grenier', {
        vide_grenier: { slug: 'vide_grenier', label: 'Vide-grenier' },
      }),
      'Vide-grenier',
    );
  });
});
