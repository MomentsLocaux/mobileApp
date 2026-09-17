import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatAuthorHomeLocation,
  formatEchoesCountLabel,
  formatEchoesListTitle,
  formatTimeAgo,
} from './relative-time';

const now = new Date('2026-09-17T12:00:00.000Z');

describe('formatTimeAgo', () => {
  it('uses Il y a… in French', () => {
    assert.equal(formatTimeAgo('2026-09-17T11:59:30.000Z', now), 'À l’instant');
    assert.equal(formatTimeAgo('2026-09-17T11:45:00.000Z', now), 'Il y a 15 minutes');
    assert.equal(formatTimeAgo('2026-09-10T12:00:00.000Z', now), 'Il y a 1 semaine');
    assert.equal(formatTimeAgo('2026-09-03T12:00:00.000Z', now), 'Il y a 2 semaines');
  });
});

describe('formatEchoesCountLabel', () => {
  it('pluralizes commentaires', () => {
    assert.equal(formatEchoesCountLabel(1), 'Afficher le commentaire');
    assert.equal(formatEchoesCountLabel(30), 'Afficher les 30 commentaires');
  });
});

describe('formatEchoesListTitle', () => {
  it('uses a count heading', () => {
    assert.equal(formatEchoesListTitle(0), 'Commentaires');
    assert.equal(formatEchoesListTitle(1), '1 commentaire');
    assert.equal(formatEchoesListTitle(30), '30 commentaires');
  });
});

describe('formatAuthorHomeLocation', () => {
  it('joins city and region', () => {
    assert.equal(formatAuthorHomeLocation('Louiseville', 'Canada'), 'Louiseville, Canada');
    assert.equal(formatAuthorHomeLocation('Nyons', null), 'Nyons');
    assert.equal(formatAuthorHomeLocation('  ', ''), null);
  });
});
