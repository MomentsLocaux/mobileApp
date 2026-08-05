import test from 'node:test';
import assert from 'node:assert/strict';
import {
  corridorHalfWidthKm,
  downsampleLine,
  estimateDetourMinutes,
  expandedBoundsOf,
  haversineKm,
  nearestPointOnPolyline,
} from './roadtrip-geo';
import type { LineStringCoordinates } from './roadtrip.types';

// Paris → Reims-ish straight line, ~130 km eastward.
const line: LineStringCoordinates = [
  [2.35, 48.85],
  [3.0, 48.9],
  [4.03, 49.25],
];

test('haversine matches known Paris–Lyon distance', () => {
  const km = haversineKm(
    { latitude: 48.8566, longitude: 2.3522 },
    { latitude: 45.764, longitude: 4.8357 },
  );
  assert.ok(Math.abs(km - 392) < 5, `expected ~392 km, got ${km}`);
});

test('nearest point on polyline: point close to the middle of the route', () => {
  const near = nearestPointOnPolyline({ latitude: 48.92, longitude: 3.0 }, line);
  assert.ok(near);
  assert.ok(near.distanceKm < 3, `distance ${near.distanceKm}`);
  assert.ok(near.progression > 0.3 && near.progression < 0.6, `progression ${near.progression}`);
});

test('nearest point on polyline: progression is 0 at origin and 1 at destination', () => {
  const start = nearestPointOnPolyline({ latitude: 48.85, longitude: 2.35 }, line);
  const end = nearestPointOnPolyline({ latitude: 49.25, longitude: 4.03 }, line);
  assert.ok(start && end);
  assert.equal(start.progression, 0);
  assert.equal(end.progression, 1);
});

test('nearest point on polyline: degenerate line returns null', () => {
  assert.equal(nearestPointOnPolyline({ latitude: 48, longitude: 2 }, [[2, 48]]), null);
});

test('detour heuristic: 7.5 km off-route at 45 km/h ≈ 20 min round trip', () => {
  assert.equal(estimateDetourMinutes(7.5), 20);
  assert.equal(estimateDetourMinutes(0), 0);
});

test('corridor width follows the detour budget', () => {
  assert.equal(corridorHalfWidthKm(10), 3.75);
  assert.equal(corridorHalfWidthKm(20), 7.5);
  assert.equal(corridorHalfWidthKm(40), 15);
});

test('downsampling caps points while keeping endpoints', () => {
  const dense: LineStringCoordinates = Array.from({ length: 2000 }, (_, i) => [
    2 + i * 0.001,
    48 + i * 0.0005,
  ]);
  const sampled = downsampleLine(dense, 800);
  assert.equal(sampled.length, 800);
  assert.deepEqual(sampled[0], dense[0]);
  assert.deepEqual(sampled[sampled.length - 1], dense[dense.length - 1]);
  // Short lines are untouched.
  assert.equal(downsampleLine(line, 800), line);
});

test('expanded bounds pad the route bbox on every side', () => {
  const bounds = expandedBoundsOf(line, 10);
  assert.ok(bounds);
  assert.ok(bounds.sw[0] < 2.35);
  assert.ok(bounds.sw[1] < 48.85);
  assert.ok(bounds.ne[0] > 4.03);
  assert.ok(bounds.ne[1] > 49.25);
  assert.equal(expandedBoundsOf([], 10), null);
});
