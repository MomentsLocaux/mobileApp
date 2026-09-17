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
  VIEWPORT_HALF_SNAP_INDEX,
  VIEWPORT_PEEK_HEIGHT,
} from './map-sheet-physics';

describe('map sheet layout', () => {
  const layoutHeight = 800;

  it('keeps the collapsed handle above the iOS home gesture area', () => {
    assert.equal(VIEWPORT_PEEK_HEIGHT, 104);
    assert.equal(getSheetSnapHeights(layoutHeight, 'viewport')[0], 104);
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
    const [peek, half] = getSheetSnapHeights(layoutHeight, 'viewport');

    assert.equal(resolveSheetSnapIndex(peek + 20, layoutHeight, 'viewport', -1.4), 1);
    assert.equal(resolveSheetSnapIndex(half - 20, layoutHeight, 'viewport', 1.4), 0);
  });

  it('chooses the nearest snap when released without momentum', () => {
    const [peek, half, full] = getSheetSnapHeights(layoutHeight, 'viewport');

    assert.equal(resolveSheetSnapIndex(peek + 4, layoutHeight, 'viewport'), 0);
    assert.equal(resolveSheetSnapIndex(half + 4, layoutHeight, 'viewport'), 1);
    assert.equal(resolveSheetSnapIndex(full - 4, layoutHeight, 'viewport'), 2);
  });

  it('normalizes sheet height to progress without leaving the 0–1 range', () => {
    const [peek, , full] = getSheetSnapHeights(layoutHeight, 'viewport');
    assert.equal(sheetHeightToProgress(peek, layoutHeight, 'viewport'), 0);
    assert.equal(sheetHeightToProgress(full, layoutHeight, 'viewport'), 1);
    assert.ok(sheetHeightToProgress((peek + full) / 2, layoutHeight, 'viewport') > 0);
    assert.ok(sheetHeightToProgress((peek + full) / 2, layoutHeight, 'viewport') < 1);
  });

  it('returns a snap target that matches the resolved index height', () => {
    const [, half] = getSheetSnapHeights(layoutHeight, 'viewport');
    const target = resolveSheetSnapTarget(half - 20, layoutHeight, 'viewport', 1.4);
    assert.equal(target.index, 0);
    assert.equal(target.height, VIEWPORT_PEEK_HEIGHT);
    assert.equal(target.progress, 0);
  });

  it('keeps the current snap when the map column shrinks under the refine panel', () => {
    const fullHeight = resolveSheetHeightForLayout(800, 'viewport', 2);
    const halfHeight = resolveSheetHeightForLayout(640, 'viewport', 1);
    const peekHeight = resolveSheetHeightForLayout(640, 'viewport', 0);

    assert.equal(fullHeight, getSheetSnapHeights(800, 'viewport')[2]);
    assert.equal(halfHeight, getSheetSnapHeights(640, 'viewport')[1]);
    assert.equal(peekHeight, VIEWPORT_PEEK_HEIGHT);
    assert.ok(halfHeight > peekHeight);
  });

  it('drops a fully expanded sheet to half when opening refine, not to peek', () => {
    assert.equal(sheetSnapIndexWhenOpeningRefine(2, 'viewport'), VIEWPORT_HALF_SNAP_INDEX);
    assert.equal(sheetSnapIndexWhenOpeningRefine(1, 'viewport'), 1);
    assert.equal(sheetSnapIndexWhenOpeningRefine(0, 'viewport'), 0);
    assert.equal(sheetSnapIndexWhenOpeningRefine(1, 'single'), 1);
  });

  it('trusts the painted sheet height when the stored snap is still peek', () => {
    const [, , full] = getSheetSnapHeights(layoutHeight, 'viewport');
    assert.equal(
      resolveEffectiveSheetSnapIndex({
        storedIndex: 0,
        visibleHeight: full,
        layoutHeight,
        mode: 'viewport',
      }),
      2
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
