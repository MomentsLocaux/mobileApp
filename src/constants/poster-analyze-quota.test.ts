import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EVENT_POSTER_ANALYZE_MAX_TRIES,
  EVENT_SUGGEST_MONTHLY_QUOTA,
  canAnalyzePoster,
  posterAnalyzeQuotaHint,
  remainingPosterAnalyses,
} from './poster-analyze-quota';

test('poster analysis allows two tries per draft then stops', () => {
  assert.equal(EVENT_POSTER_ANALYZE_MAX_TRIES, 2);
  assert.equal(EVENT_SUGGEST_MONTHLY_QUOTA, 20);
  assert.equal(canAnalyzePoster(0), true);
  assert.equal(canAnalyzePoster(1), true);
  assert.equal(canAnalyzePoster(2), false);
  assert.equal(remainingPosterAnalyses(0), 2);
  assert.equal(remainingPosterAnalyses(1), 1);
  assert.equal(remainingPosterAnalyses(2), 0);
  assert.equal(remainingPosterAnalyses(9), 0);
});

test('poster quota hint switches when the last try is used', () => {
  assert.match(posterAnalyzeQuotaHint(0), /2 analyses par suggestion/);
  assert.match(posterAnalyzeQuotaHint(1), /Dernière analyse/);
  assert.match(posterAnalyzeQuotaHint(2), /Limite atteinte/);
});
