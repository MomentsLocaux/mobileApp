import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EventWithCreator } from '../types/database';
import { extractEventCoords } from './event-coords';
import { pickSimilarEvents, resolveEventCategoryKey } from './similar-events';

const now = new Date('2026-09-17T12:00:00.000Z');

const event = (overrides: Partial<EventWithCreator> & { id: string }): EventWithCreator =>
  ({
    title: overrides.id,
    tags: [],
    starts_at: '2026-09-18T18:00:00.000Z',
    ends_at: '2026-09-18T20:00:00.000Z',
    latitude: 44.36,
    longitude: 5.14,
    category: 'concert',
    category_meta: { slug: 'concert' },
    ...overrides,
  }) as EventWithCreator;

describe('resolveEventCategoryKey', () => {
  it('prefers category_meta slug over the raw category id', () => {
    assert.equal(
      resolveEventCategoryKey({
        category: '16ea211a-c962-4cf9-96d0-ab28447991f4',
        category_meta: { slug: 'Concert' },
      }),
      'concert',
    );
  });
});

describe('pickSimilarEvents', () => {
  const source = event({
    id: 'source',
    tags: ['jazz', 'openagenda_api'],
    latitude: 44.36,
    longitude: 5.14,
  });

  it('requires shared visible tags when the source has tags', () => {
    const tagged = event({ id: 'tagged', tags: ['jazz'], latitude: 44.361, longitude: 5.141 });
    const categoryOnly = event({ id: 'category', tags: ['rock'], latitude: 44.362, longitude: 5.142 });
    const picked = pickSimilarEvents({
      source,
      candidates: [tagged, categoryOnly],
      origin: { latitude: 44.36, longitude: 5.14 },
      now,
    });
    assert.deepEqual(picked.map((item) => item.id), ['tagged']);
  });

  it('falls back to category only when the source has no visible tags', () => {
    const bare = event({ id: 'bare', tags: ['needs_review'] });
    const same = event({ id: 'same', tags: [], latitude: 44.361, longitude: 5.141 });
    const otherCat = event({
      id: 'other',
      category: 'sport',
      category_meta: { slug: 'sport' },
      latitude: 44.361,
      longitude: 5.141,
    });
    const picked = pickSimilarEvents({
      source: bare,
      candidates: [same, otherCat],
      origin: { latitude: 44.36, longitude: 5.14 },
      now,
    });
    assert.deepEqual(picked.map((item) => item.id), ['same']);
  });

  it('excludes the current event, far events, and caps at three', () => {
    const nearby = ['a', 'b', 'c', 'd'].map((id, index) =>
      event({
        id,
        tags: ['jazz'],
        latitude: 44.36 + index * 0.002,
        longitude: 5.14,
      }),
    );
    const far = event({
      id: 'far',
      tags: ['jazz'],
      latitude: 45.5,
      longitude: 6.5,
    });
    const picked = pickSimilarEvents({
      source,
      candidates: [source, far, ...nearby],
      origin: { latitude: 44.36, longitude: 5.14 },
      now,
    });
    assert.equal(picked.length, 3);
    assert.equal(picked.some((item) => item.id === 'source' || item.id === 'far'), false);
  });

  it('excludes another event with the same title', () => {
    const duplicate = event({
      id: 'duplicate',
      title: '  Marché de Nyons  ',
      tags: ['jazz'],
      latitude: 44.361,
      longitude: 5.141,
    });
    const other = event({
      id: 'other-jazz',
      title: 'Jazz à Nyons',
      tags: ['jazz'],
      latitude: 44.362,
      longitude: 5.142,
    });
    const picked = pickSimilarEvents({
      source: event({
        id: 'source-market',
        title: 'marché de nyons',
        tags: ['jazz'],
      }),
      candidates: [duplicate, other],
      origin: { latitude: 44.36, longitude: 5.14 },
      now,
    });
    assert.deepEqual(picked.map((item) => item.id), ['other-jazz']);
  });
});

describe('extractEventCoords', () => {
  it('reads latitude/longitude and ignores the null island', () => {
    assert.deepEqual(extractEventCoords({ latitude: 44.36, longitude: 5.14 }), {
      latitude: 44.36,
      longitude: 5.14,
    });
    assert.equal(extractEventCoords({ latitude: 0, longitude: 0 }), null);
  });
});
