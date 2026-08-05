import test from 'node:test';
import assert from 'node:assert/strict';
import { getProposalCategoryLabel } from './proposal-category-display';

test('proposal cards use the canonical Fêtes & Animations label', () => {
  assert.equal(
    getProposalCategoryLabel({
      slug: 'fetes-animations',
      label: 'Fêtes & Animation',
      icon: 'music',
    }),
    'Fêtes & Animations',
  );
});

test('proposal category labels never include the legacy icon key', () => {
  assert.equal(
    getProposalCategoryLabel({ slug: 'arts-culture', label: 'Arts & Culture', icon: 'theater' }),
    'Arts & Culture',
  );
});
