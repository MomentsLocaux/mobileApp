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
});
