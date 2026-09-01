import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { matchAppHelp } from './lumia-help';

describe('matchAppHelp', () => {
  it('answers how-to questions about the map', () => {
    const hit = matchAppHelp('comment ouvrir la carte ?');
    assert.ok(hit);
    assert.equal(hit.id, 'map');
    assert.equal(hit.preferHelp, true);
    assert.match(hit.answer, /Carte/i);
  });

  it('does not treat a city gig search as app help', () => {
    const hit = matchAppHelp('concert jazz à Lyon ce weekend');
    assert.ok(!hit || hit.preferHelp === false);
  });

  it('answers pricing questions from the public website, not in-app SKUs', () => {
    const hit = matchAppHelp('combien coûte l’abonnement ?');
    assert.ok(hit);
    assert.equal(hit.id, 'offers-mvp');
    assert.equal(hit.preferHelp, true);
    assert.match(hit.answer, /moments-locaux\.com\/offres/i);
    assert.doesNotMatch(hit.answer, /niveaux Local \/ Habitué \/ Éclaireur/);
  });
});
