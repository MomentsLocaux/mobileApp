import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildViewportBoundsKey,
  createViewportRequestTracker,
  isViewportRequestCurrent,
  nextViewportRequest,
  resolveProgrammaticBoundsAction,
  shouldSkipDuplicateViewportFetch,
} from './map-viewport-request';

describe('map viewport request tracker', () => {
  it('builds a stable bounds key', () => {
    const key = buildViewportBoundsKey(
      { ne: [6.2, 49.4], sw: [5.9, 49.1] },
      500
    );
    assert.equal(key, '6.2|49.4|5.9|49.1|500');
  });

  it('invalidates stale request ids after cancellation', () => {
    const tracker = createViewportRequestTracker();
    const first = nextViewportRequest(tracker);
    const second = nextViewportRequest(tracker);

    assert.equal(isViewportRequestCurrent(tracker, second), true);
    assert.equal(isViewportRequestCurrent(tracker, first), false);
  });

  it('skips duplicate in-flight viewport fetches unless forced', () => {
    const boundsKey = buildViewportBoundsKey(
      { ne: [6.2, 49.4], sw: [5.9, 49.1] },
      500
    );

    assert.equal(shouldSkipDuplicateViewportFetch(null, boundsKey), false);
    assert.equal(shouldSkipDuplicateViewportFetch(boundsKey, boundsKey), true);
    assert.equal(shouldSkipDuplicateViewportFetch(boundsKey, boundsKey, { force: true }), false);
  });

  it('waits through camera animation and oversized bboxes before a programmatic fetch', () => {
    assert.equal(
      resolveProgrammaticBoundsAction({
        recalcSuppressed: true,
        boundsTooLarge: false,
        refreshAfter: true,
      }),
      'wait'
    );
    assert.equal(
      resolveProgrammaticBoundsAction({
        recalcSuppressed: false,
        boundsTooLarge: true,
        refreshAfter: true,
      }),
      'wait'
    );
    assert.equal(
      resolveProgrammaticBoundsAction({
        recalcSuppressed: false,
        boundsTooLarge: false,
        refreshAfter: true,
      }),
      'fetch'
    );
    assert.equal(
      resolveProgrammaticBoundsAction({
        recalcSuppressed: false,
        boundsTooLarge: false,
        refreshAfter: false,
      }),
      'ignore'
    );
  });
});
