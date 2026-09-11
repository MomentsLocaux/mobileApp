import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultCoverToneForCategorySlug, isCoverTone } from './cover-tone';

test('maps known category slugs to a cover tone', () => {
  assert.equal(defaultCoverToneForCategorySlug('fetes-animations'), 'festif');
  assert.equal(defaultCoverToneForCategorySlug('arts-culture'), 'intimiste');
  assert.equal(defaultCoverToneForCategorySlug('ateliers-apprentissage'), 'intimiste');
  assert.equal(defaultCoverToneForCategorySlug('nature-bienetre'), 'nature');
  assert.equal(defaultCoverToneForCategorySlug('vie-locale'), 'sobre');
  assert.equal(defaultCoverToneForCategorySlug(undefined), 'sobre');
});

test('accepts only known cover tones', () => {
  assert.equal(isCoverTone('sobre'), true);
  assert.equal(isCoverTone('cyberpunk'), false);
  assert.equal(isCoverTone(''), false);
});
