import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  cloneMapBounds,
  cloneSheetCameraSnapshot,
  resolveSheetCameraFitBounds,
  shouldCaptureSheetCameraAnchor,
  shouldRestoreSheetCameraAnchor,
} from './map-sheet-camera';

describe('map sheet camera cycle', () => {
  it('captures an anchor only when leaving peek without one already held', () => {
    assert.equal(shouldCaptureSheetCameraAnchor(1, false), true);
    assert.equal(shouldCaptureSheetCameraAnchor(2, false), true);
    assert.equal(shouldCaptureSheetCameraAnchor(1, true), false);
    assert.equal(shouldCaptureSheetCameraAnchor(0, false), false);
  });

  it('restores the peek camera only when returning to peek', () => {
    assert.equal(shouldRestoreSheetCameraAnchor(0), true);
    assert.equal(shouldRestoreSheetCameraAnchor(1), false);
    assert.equal(shouldRestoreSheetCameraAnchor(2), false);
  });

  it('fits the camera to the peek-time raw bounds and never to query bounds', () => {
    const raw = { sw: [1, 2] as [number, number], ne: [3, 4] as [number, number] };
    const fitted = resolveSheetCameraFitBounds(raw);
    assert.deepEqual(fitted, raw);
    assert.notEqual(fitted, raw);
    assert.equal(resolveSheetCameraFitBounds(null), null);
  });

  it('copies snapshot and bounds so later camera ticks cannot mutate the anchor', () => {
    const snapshot = { longitude: 5, latitude: 45, zoom: 12 };
    const bounds = { sw: [1, 2] as [number, number], ne: [3, 4] as [number, number] };
    const nextSnapshot = cloneSheetCameraSnapshot(snapshot);
    const nextBounds = cloneMapBounds(bounds);
    snapshot.zoom = 8;
    bounds.ne[0] = 9;
    assert.equal(nextSnapshot.zoom, 12);
    assert.equal(nextBounds.ne[0], 3);
  });
});
