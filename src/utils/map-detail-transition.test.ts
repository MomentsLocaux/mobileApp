import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getMapDetailSlideOffset,
  isUsableTransitionRect,
  shouldCompleteMapDetailDismiss,
} from './map-detail-transition';

describe('map detail transition', () => {
  it('completes a long downward drag', () => {
    assert.equal(shouldCompleteMapDetailDismiss(190, 0, 800), true);
  });

  it('completes a short but fast downward fling', () => {
    assert.equal(shouldCompleteMapDetailDismiss(48, 900, 800), true);
  });

  it('cancels a short slow drag', () => {
    assert.equal(shouldCompleteMapDetailDismiss(60, 300, 800), false);
  });

  it('rejects missing or empty target rectangles', () => {
    assert.equal(isUsableTransitionRect(null), false);
    assert.equal(
      isUsableTransitionRect({ x: 12, y: 24, width: 0, height: 108 }),
      false,
    );
    assert.equal(
      isUsableTransitionRect({ x: 12, y: 24, width: 320, height: 108 }),
      true,
    );
  });

  it('keeps the detail slide offset in a stable band across screen sizes', () => {
    assert.equal(getMapDetailSlideOffset(0), 96);
    assert.ok(getMapDetailSlideOffset(700) >= 96);
    assert.ok(getMapDetailSlideOffset(700) <= 160);
    assert.equal(getMapDetailSlideOffset(2000), 160);
  });
});
