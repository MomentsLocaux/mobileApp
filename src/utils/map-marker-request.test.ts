import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createViewportRequestTracker, nextViewportRequest, isViewportRequestCurrent } from './map-viewport-request';

describe('marker request invalidation', () => {
  it('drops stale marker responses after a newer selection starts', () => {
    const tracker = createViewportRequestTracker();
    const first = nextViewportRequest(tracker);
    const second = nextViewportRequest(tracker);

    assert.equal(isViewportRequestCurrent(tracker, first), false);
    assert.equal(isViewportRequestCurrent(tracker, second), true);
  });
});
