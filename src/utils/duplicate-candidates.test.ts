import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  distinctiveTitleQuery,
  haversineKm,
  hasDuplicateSearchOrigin,
  rankDuplicateCandidates,
  titleOverlapScore,
} from './duplicate-candidates';

const ROUEN = { latitude: 49.4431, longitude: 1.0993 };

describe('duplicate candidates', () => {
  it('ignores a fiche without a usable place', () => {
    assert.equal(hasDuplicateSearchOrigin({ latitude: null, longitude: null }), false);
    assert.equal(hasDuplicateSearchOrigin({ latitude: 0, longitude: 0 }), false);
    assert.deepEqual(
      rankDuplicateCandidates({ id: 'a', title: 'Concert jazz', latitude: null, longitude: null }, [
        { id: 'b', title: 'Concert jazz', ...ROUEN },
      ]),
      [],
    );
  });

  it('keeps a nearby event with an overlapping title and drops far or unrelated ones', () => {
    const ranked = rankDuplicateCandidates(
      { id: 'src', title: 'Concert jazz au Hangar', ...ROUEN },
      [
        { id: 'src', title: 'Concert jazz au Hangar', latitude: 49.4432, longitude: 1.0994 },
        { id: 'near', title: 'Soirée jazz Hangar', latitude: 49.445, longitude: 1.1 },
        { id: 'far', title: 'Concert jazz', latitude: 48.8566, longitude: 2.3522 },
        { id: 'other', title: 'Marché de Noël', latitude: 49.444, longitude: 1.1 },
      ],
    );

    assert.deepEqual(
      ranked.map((item) => item.id),
      ['near'],
    );
    assert.ok(ranked[0].distanceKm < 5);
    assert.ok(ranked[0].titleScore > 0);
  });

  it('prefers a stronger title overlap over a slightly closer mismatch', () => {
    const ranked = rankDuplicateCandidates(
      { id: 'src', title: 'Marché de Noël de Rouen', ...ROUEN },
      [
        {
          id: 'weak',
          title: 'Marché du samedi',
          latitude: 49.4432,
          longitude: 1.0994,
        },
        {
          id: 'strong',
          title: 'Grand marché de Noël',
          latitude: 49.45,
          longitude: 1.11,
        },
      ],
    );

    assert.equal(ranked[0].id, 'strong');
    assert.ok(ranked[0].titleScore > ranked[1].titleScore);
  });

  it('uses one distinctive token for the server ilike prefilter', () => {
    assert.equal(distinctiveTitleQuery('le marché de Noël'), 'marché');
    assert.equal(distinctiveTitleQuery('Jazz'), 'jazz');
    assert.equal(distinctiveTitleQuery('le'), undefined);
  });

  it('rejects a single short shared token', () => {
    assert.equal(titleOverlapScore('Au bar', 'Au café'), 0);
  });

  it('caps the list at eight nearby matches', () => {
    const events = Array.from({ length: 12 }, (_, index) => ({
      id: `e${index}`,
      title: 'Concert jazz Hangar',
      latitude: 49.4432 + index * 0.0002,
      longitude: 1.0994,
    }));
    assert.equal(
      rankDuplicateCandidates({ id: 'src', title: 'Concert jazz au Hangar', ...ROUEN }, events).length,
      8,
    );
  });

  it('measures a short urban hop as under 5 km', () => {
    assert.ok(haversineKm(ROUEN.latitude, ROUEN.longitude, 49.45, 1.11) < 5);
    assert.ok(haversineKm(ROUEN.latitude, ROUEN.longitude, 48.8566, 2.3522) > 5);
  });
});
