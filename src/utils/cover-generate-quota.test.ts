import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EVENT_COVER_GENERATE_MAX_TRIES,
  canGenerateEventCover,
  remainingCoverGenerations,
} from '../constants/cover-generate-quota';

test('cover generation allows two tries then stops', () => {
  assert.equal(EVENT_COVER_GENERATE_MAX_TRIES, 2);
  assert.equal(canGenerateEventCover(0), true);
  assert.equal(canGenerateEventCover(1), true);
  assert.equal(canGenerateEventCover(2), false);
  assert.equal(remainingCoverGenerations(0), 2);
  assert.equal(remainingCoverGenerations(1), 1);
  assert.equal(remainingCoverGenerations(2), 0);
  assert.equal(remainingCoverGenerations(9), 0);
});
