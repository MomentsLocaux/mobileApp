import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatResolvedEventTagLabel,
  getEventCoverImageSource,
  getEventImageUrls,
  getEventPrefetchUrls,
  EVENT_LIST_COVER_DECODE_PX,
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

describe('event media prefetch urls', () => {
  it('prefetches the cover already shown on the card', () => {
    const event = {
      cover_url: 'https://cdn.example/cover.jpg',
      media: [],
    };
    assert.deepEqual(getEventPrefetchUrls(event), ['https://cdn.example/cover.jpg']);
    assert.deepEqual(getEventImageUrls(event), getEventPrefetchUrls(event));
  });

  it('skips empty or placeholder covers', () => {
    assert.deepEqual(getEventPrefetchUrls({ cover_url: 'null', media: [] }), []);
    assert.deepEqual(getEventPrefetchUrls(null), []);
  });

  it('can prefetch the gallery already attached to the event', () => {
    assert.deepEqual(
      getEventPrefetchUrls(
        {
          cover_url: 'https://cdn.example/cover.jpg',
          media: [{ url: 'https://cdn.example/extra.jpg' } as never],
        },
        { includeGallery: true },
      ),
      ['https://cdn.example/cover.jpg', 'https://cdn.example/extra.jpg'],
    );
  });

  it('keeps the same URI and cache key for list decode and fiche hero', () => {
    const uri = 'https://cdn.example/cover.jpg';
    const list = getEventCoverImageSource(uri, 'list');
    const detail = getEventCoverImageSource(uri, 'detail');
    assert.equal(list.uri, detail.uri);
    assert.equal(list.cacheKey, detail.cacheKey);
    assert.equal(list.cacheKey, uri);
    assert.equal(list.width, EVENT_LIST_COVER_DECODE_PX);
    assert.equal(detail.width, undefined);
  });
});
