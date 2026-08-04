import test from 'node:test';
import assert from 'node:assert/strict';
import { getProposalCategoryHint } from './proposal-category-hints';

const CATEGORY_SLUGS = [
  'arts-culture',
  'marches-artisanat',
  'fetes-animations',
  'famille-enfants',
  'gastronomie-saveurs',
  'nature-bienetre',
  'ateliers-apprentissage',
  'sport-loisirs',
  'vie-locale',
  'insolite-ephemere',
];

test('every current proposal category has a useful hint', () => {
  CATEGORY_SLUGS.forEach((slug) => {
    const hint = getProposalCategoryHint(slug);
    assert.ok(hint.length >= 30, `${slug} should have a descriptive hint`);
    assert.doesNotMatch(hint, /^(shop|playground|marker|music|fitness)$/);
  });
});

test('unknown categories receive a readable fallback', () => {
  assert.match(getProposalCategoryHint('future-category'), /événements locaux/i);
});

