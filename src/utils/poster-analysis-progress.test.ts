import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  posterAnalysisEaseProgress,
  posterAnalysisPercent,
  posterAnalysisStepStatus,
} from './poster-analysis-progress';

describe('poster analysis progress', () => {
  it('maps each pipeline step to a rising percent without reaching 100 until complete', () => {
    assert.equal(posterAnalysisPercent('prepare', 0), 0);
    assert.equal(posterAnalysisPercent('upload', 0), 20);
    assert.equal(posterAnalysisPercent('vision', 0.5), 50);
    assert.equal(posterAnalysisPercent('prefill', 0.9), 98);
    assert.equal(posterAnalysisPercent('prefill', 1), 99);
    assert.equal(posterAnalysisPercent('prefill', 1, { complete: true }), 100);
  });

  it('marks previous steps done and later steps pending', () => {
    assert.equal(posterAnalysisStepStatus('prepare', 'vision'), 'done');
    assert.equal(posterAnalysisStepStatus('vision', 'vision'), 'active');
    assert.equal(posterAnalysisStepStatus('place', 'vision'), 'pending');
    assert.equal(posterAnalysisStepStatus('place', 'vision', { complete: true }), 'done');
  });

  it('eases long waits toward 90% of the slice without completing it', () => {
    assert.equal(posterAnalysisEaseProgress(0), 0);
    assert.ok(posterAnalysisEaseProgress(8000) > 0.5);
    assert.ok(posterAnalysisEaseProgress(60_000) < 0.91);
  });
});
