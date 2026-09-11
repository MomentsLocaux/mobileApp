import test from 'node:test';
import assert from 'node:assert/strict';
import { coverGenerateSteps } from './cover-generate-progress';
import { stagedProgressPercent } from './staged-progress';

test('skips the photo step when there is no reference', () => {
  const withPhoto = coverGenerateSteps(true);
  const withoutPhoto = coverGenerateSteps(false);
  assert.equal(withPhoto.some((step) => step.id === 'photo'), true);
  assert.equal(withoutPhoto.some((step) => step.id === 'photo'), false);
  assert.equal(withoutPhoto.length, 3);
});

test('image wait stays under 100 until complete', () => {
  const steps = coverGenerateSteps(true);
  assert.equal(stagedProgressPercent(steps, 'fiche', 0), 0);
  assert.ok(stagedProgressPercent(steps, 'image', 0.9) < 100);
  assert.equal(stagedProgressPercent(steps, 'save', 1, { complete: true }), 100);
});
