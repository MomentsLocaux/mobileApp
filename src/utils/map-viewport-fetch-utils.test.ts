import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildMapViewportCacheKey,
  getMapBoundsDiameterKm,
  getViewportCacheDisposition,
  haveMapBoundsMeaningfullyChanged,
  insetMapBoundsForBottomOverlay,
  isMapBoundsTooLarge,
  MAP_BBOX_TIGHTEN_DIAMETER_KM,
  raceWithViewportTimeout,
  shrinkMapBoundsToMaxDiameter,
} from './map-viewport-fetch-utils';

describe('map viewport fetch helpers', () => {
  it('builds a stable cache key for identical viewport requests', () => {
    const bbox = {
      ne: [6.2, 49.4] as [number, number],
      sw: [5.9, 49.1] as [number, number],
      limit: 500,
    };

    const keyA = buildMapViewportCacheKey(bbox, 'current');
    const keyB = buildMapViewportCacheKey(bbox, 'current');
    const keyC = buildMapViewportCacheKey(bbox, 'current', { mergeUpcomingForDatePreset: true });

    assert.equal(keyA, keyB);
    assert.notEqual(keyA, keyC);
    assert.notEqual(keyA, buildMapViewportCacheKey(bbox, 'upcoming'));
  });

  it('distinguishes fresh, stale and expired viewport payloads', () => {
    assert.equal(getViewportCacheDisposition(9_980, 10_000, 50, 500), 'fresh');
    assert.equal(getViewportCacheDisposition(9_800, 10_000, 50, 500), 'stale');
    assert.equal(getViewportCacheDisposition(9_000, 10_000, 50, 500), 'expired');
  });

  it('clears the timeout timer when the underlying promise resolves first', async () => {
    const result = await raceWithViewportTimeout(Promise.resolve({ ok: true }), 50);
    assert.deepEqual(result, { ok: true });
  });

  it('rejects when the underlying promise exceeds the client timeout', async () => {
    await assert.rejects(
      () =>
        raceWithViewportTimeout(
          new Promise((resolve) => {
            setTimeout(() => resolve('late'), 80);
          }),
          20
        ),
      (error: Error & { code?: string }) => {
        assert.match(error.message, /client timeout/);
        assert.equal(error.code, '57014');
        return true;
      }
    );
  });

  it('accepts a 300 km bbox and blocks a wider viewport', () => {
    const accepted = {
      sw: [5, 49] as [number, number],
      ne: [5.5, 49 + 300 / 111] as [number, number],
    };
    const rejected = {
      sw: [5, 49] as [number, number],
      ne: [5.5, 49 + 301 / 111] as [number, number],
    };

    assert.ok(Math.abs(getMapBoundsDiameterKm(accepted) - 300) < 0.01);
    assert.equal(isMapBoundsTooLarge(accepted), false);
    assert.equal(isMapBoundsTooLarge(rejected), true);
  });

  it('leaves a bbox already under the tighten target unchanged', () => {
    const accepted = {
      sw: [5, 49] as [number, number],
      ne: [5.5, 49 + 50 / 111] as [number, number],
    };
    assert.equal(shrinkMapBoundsToMaxDiameter(accepted), accepted);
  });

  it('shrinks an oversized bbox around its center to a local diameter', () => {
    const oversized = {
      sw: [5, 49] as [number, number],
      ne: [5.5, 49 + 600 / 111] as [number, number],
    };
    const tightened = shrinkMapBoundsToMaxDiameter(oversized);

    assert.equal(isMapBoundsTooLarge(tightened), false);
    assert.ok(
      Math.abs(getMapBoundsDiameterKm(tightened) - MAP_BBOX_TIGHTEN_DIAMETER_KM) < 0.5
    );
    assert.ok(
      Math.abs(
        (oversized.ne[0] + oversized.sw[0]) / 2 - (tightened.ne[0] + tightened.sw[0]) / 2
      ) < 1e-10
    );
    assert.ok(
      Math.abs(
        (oversized.ne[1] + oversized.sw[1]) / 2 - (tightened.ne[1] + tightened.sw[1]) / 2
      ) < 1e-10
    );
  });

  it('ignores camera-settle noise but detects a real searched-area move', () => {
    const committed = {
      sw: [5.9, 49.1] as [number, number],
      ne: [6.2, 49.4] as [number, number],
    };
    assert.equal(
      haveMapBoundsMeaningfullyChanged(committed, {
        sw: [5.90001, 49.10001],
        ne: [6.20001, 49.40001],
      }),
      false
    );
    assert.equal(
      haveMapBoundsMeaningfullyChanged(committed, {
        sw: [6.0, 49.2],
        ne: [6.3, 49.5],
      }),
      true
    );
  });

  it('raises the south edge so a bottom sheet overlay is outside the fetch bbox', () => {
    const bounds = {
      sw: [6, 48] as [number, number],
      ne: [7, 49] as [number, number],
    };
    const inset = insetMapBoundsForBottomOverlay(bounds, {
      mapHeightPx: 800,
      overlayBottomPx: 80,
    });
    assert.equal(inset.sw[0], 6);
    assert.equal(inset.ne[0], 7);
    assert.equal(inset.ne[1], 49);
    assert.ok(Math.abs(inset.sw[1] - (48 + 80 / 800)) < 1e-10);
    assert.deepEqual(
      insetMapBoundsForBottomOverlay(bounds, { mapHeightPx: 800, overlayBottomPx: 0 }),
      bounds
    );
  });
});
