import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getSheetSnapHeights,
  resolveEffectiveSheetSnapIndex,
  resolveMapTabBarProgress,
  resolveSheetHeightForLayout,
  resolveSheetSnapIndex,
  resolveSheetSnapTarget,
  sheetHeightToProgress,
  sheetSnapIndexWhenOpeningRefine,
  VIEWPORT_FULL_RATIO,
  VIEWPORT_FULL_SNAP_INDEX,
  VIEWPORT_HALF_SNAP_INDEX,
  VIEWPORT_PEEK_HEIGHT,
} from './map-sheet-physics';

describe('map sheet layout', () => {
  const layoutHeight = 800;

  it('keeps the collapsed handle above the iOS home gesture area', () => {
    assert.equal(VIEWPORT_PEEK_HEIGHT, 104);
    assert.equal(getSheetSnapHeights(layoutHeight, 'viewport')[0], 104);
  });

  it('exposes only peek and full snaps in viewport mode', () => {
    const snaps = getSheetSnapHeights(layoutHeight, 'viewport');
    assert.equal(snaps.length, 2);
    assert.equal(snaps[0], VIEWPORT_PEEK_HEIGHT);
    assert.equal(snaps[1], Math.round(layoutHeight * VIEWPORT_FULL_RATIO));
    assert.equal(VIEWPORT_HALF_SNAP_INDEX, VIEWPORT_FULL_SNAP_INDEX);
  });

  it('reveals the map tab bar progressively and clamps its progress', () => {
    assert.equal(resolveMapTabBarProgress(-1), 0);
    assert.equal(resolveMapTabBarProgress(0.04), 0);
    assert.equal(resolveMapTabBarProgress(0.15), 0);
    assert.ok(resolveMapTabBarProgress(0.3) > 0);
    assert.ok(resolveMapTabBarProgress(0.3) < 1);
    assert.equal(resolveMapTabBarProgress(0.56), 1);
    assert.equal(resolveMapTabBarProgress(2), 1);
  });

  it('uses projected inertia to choose the next viewport snap', () => {
    const [peek, full] = getSheetSnapHeights(layoutHeight, 'viewport');

    assert.equal(resolveSheetSnapIndex(peek + 20, layoutHeight, 'viewport', -1.4), 1);
    assert.equal(resolveSheetSnapIndex(full - 20, layoutHeight, 'viewport', 1.4), 0);
  });

  it('chooses the nearest snap when released without momentum', () => {
    const [peek, full] = getSheetSnapHeights(layoutHeight, 'viewport');

    assert.equal(resolveSheetSnapIndex(peek + 4, layoutHeight, 'viewport'), 0);
    assert.equal(resolveSheetSnapIndex(full - 4, layoutHeight, 'viewport'), 1);
  });

  it('normalizes sheet height to progress without leaving the 0–1 range', () => {
    const [peek, full] = getSheetSnapHeights(layoutHeight, 'viewport');
    assert.equal(sheetHeightToProgress(peek, layoutHeight, 'viewport'), 0);
    assert.equal(sheetHeightToProgress(full, layoutHeight, 'viewport'), 1);
    assert.ok(sheetHeightToProgress((peek + full) / 2, layoutHeight, 'viewport') > 0);
    assert.ok(sheetHeightToProgress((peek + full) / 2, layoutHeight, 'viewport') < 1);
  });

  it('returns a snap target that matches the resolved index height', () => {
    const [, full] = getSheetSnapHeights(layoutHeight, 'viewport');
    const target = resolveSheetSnapTarget(full - 20, layoutHeight, 'viewport', 1.4);
    assert.equal(target.index, 0);
    assert.equal(target.height, VIEWPORT_PEEK_HEIGHT);
    assert.equal(target.progress, 0);
  });

  it('keeps the current snap when the map column shrinks under the refine panel', () => {
    const fullHeight = resolveSheetHeightForLayout(800, 'viewport', 1);
    const fullOnNarrow = resolveSheetHeightForLayout(640, 'viewport', 1);
    const peekHeight = resolveSheetHeightForLayout(640, 'viewport', 0);

    assert.equal(fullHeight, getSheetSnapHeights(800, 'viewport')[1]);
    assert.equal(fullOnNarrow, getSheetSnapHeights(640, 'viewport')[1]);
    assert.equal(peekHeight, VIEWPORT_PEEK_HEIGHT);
    assert.ok(fullOnNarrow > peekHeight);
  });

  it('drops a fully expanded sheet to peek when opening refine', () => {
    assert.equal(sheetSnapIndexWhenOpeningRefine(1, 'viewport'), 0);
    assert.equal(sheetSnapIndexWhenOpeningRefine(0, 'viewport'), 0);
    assert.equal(sheetSnapIndexWhenOpeningRefine(1, 'single'), 1);
  });

  it('trusts the painted sheet height when the stored snap is still peek', () => {
    const [, full] = getSheetSnapHeights(layoutHeight, 'viewport');
    assert.equal(
      resolveEffectiveSheetSnapIndex({
        storedIndex: 0,
        visibleHeight: full,
        layoutHeight,
        mode: 'viewport',
      }),
      1
    );
    assert.equal(
      resolveEffectiveSheetSnapIndex({
        storedIndex: 1,
        visibleHeight: VIEWPORT_PEEK_HEIGHT,
        layoutHeight,
        mode: 'viewport',
      }),
      1
    );
  });
});
