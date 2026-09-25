import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  COVER_PREFETCH_AHEAD_LIMIT,
  COVER_PREFETCH_CONCURRENCY,
  createCoverPrefetchController,
} from './cover-prefetch-queue';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('cover prefetch queue', () => {
  it('dedupes URLs and keeps visible jobs ahead of lookahead', async () => {
    const started: string[] = [];
    const controller = createCoverPrefetchController({
      concurrency: 1,
      prefetch: async (uri) => {
        started.push(uri);
        await wait(5);
      },
    });
    controller.enqueue(['https://a', 'https://a', '', 'https://b', 'https://c'], 'ahead');
    controller.enqueue(['https://c'], 'visible');
    await controller.whenIdle();
    assert.deepEqual(started, ['https://c', 'https://a', 'https://b']);
  });

  it('caps concurrent native prefetch work', async () => {
    let current = 0;
    let peak = 0;
    const controller = createCoverPrefetchController({
      concurrency: COVER_PREFETCH_CONCURRENCY,
      prefetch: async () => {
        current += 1;
        peak = Math.max(peak, current);
        await wait(15);
        current -= 1;
      },
    });
    controller.enqueue(['1', '2', '3', '4', '5', '6'], 'ahead');
    await controller.whenIdle();
    assert.equal(peak, COVER_PREFETCH_CONCURRENCY);
  });

  it('drops queued lookahead when the discovery zone changes', async () => {
    const started: string[] = [];
    let releaseVisible!: () => void;
    const visibleGate = new Promise<void>((resolve) => {
      releaseVisible = resolve;
    });
    const controller = createCoverPrefetchController({
      concurrency: 1,
      prefetch: async (uri) => {
        started.push(uri);
        if (uri === 'visible') await visibleGate;
      },
    });
    controller.enqueue(['visible'], 'visible');
    controller.enqueue(['ahead-1', 'ahead-2'], 'ahead');
    await wait(5);
    controller.bumpGeneration();
    releaseVisible();
    await controller.whenIdle();
    assert.deepEqual(started, ['visible']);
    assert.equal(COVER_PREFETCH_AHEAD_LIMIT, 6);
  });
});
