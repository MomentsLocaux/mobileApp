import type { LatLng, LineStringCoordinates } from './roadtrip.types';

const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type NearestPointOnLine = {
  /** Great-circle distance from the point to the polyline (km). */
  distanceKm: number;
  /** 0..1 — fraction of the polyline length travelled at the nearest point. */
  progression: number;
};

/**
 * Nearest point of `point` on a GeoJSON LineString, with progression along it.
 *
 * Uses a local equirectangular projection per segment: precise enough for a
 * driving corridor of a few dozen km, and cheap enough to run on hundreds of
 * events client-side. Not suitable for polar or antimeridian routes.
 */
export function nearestPointOnPolyline(
  point: LatLng,
  line: LineStringCoordinates,
): NearestPointOnLine | null {
  if (line.length < 2) return null;

  const refLat = toRad(point.latitude);
  const kmPerLonDeg = ((Math.PI * EARTH_RADIUS_KM) / 180) * Math.cos(refLat);
  const kmPerLatDeg = (Math.PI * EARTH_RADIUS_KM) / 180;

  const project = (lon: number, lat: number): [number, number] => [
    lon * kmPerLonDeg,
    lat * kmPerLatDeg,
  ];

  const [px, py] = project(point.longitude, point.latitude);

  let best: { distanceKm: number; lengthAtKm: number } | null = null;
  let cumulativeKm = 0;
  let totalKm = 0;

  for (let i = 0; i < line.length - 1; i += 1) {
    const [ax, ay] = project(line[i][0], line[i][1]);
    const [bx, by] = project(line[i + 1][0], line[i + 1][1]);
    const segDx = bx - ax;
    const segDy = by - ay;
    const segLengthKm = Math.hypot(segDx, segDy);

    let t = 0;
    if (segLengthKm > 0) {
      t = ((px - ax) * segDx + (py - ay) * segDy) / (segLengthKm * segLengthKm);
      t = Math.max(0, Math.min(1, t));
    }

    const nx = ax + t * segDx;
    const ny = ay + t * segDy;
    const distanceKm = Math.hypot(px - nx, py - ny);

    if (!best || distanceKm < best.distanceKm) {
      best = { distanceKm, lengthAtKm: cumulativeKm + t * segLengthKm };
    }
    cumulativeKm += segLengthKm;
    totalKm = cumulativeKm;
  }

  if (!best || totalKm === 0) {
    return best ? { distanceKm: best.distanceKm, progression: 0 } : null;
  }

  return {
    distanceKm: best.distanceKm,
    progression: Math.max(0, Math.min(1, best.lengthAtKm / totalKm)),
  };
}

/** Average access speed used by the detour heuristic (secondary roads). */
const DETOUR_SPEED_KMH = 45;

/**
 * Heuristic detour: leave the route, reach the event, come back.
 * Refined with a real Directions call only for shortlisted candidates.
 */
export function estimateDetourMinutes(distanceToRouteKm: number): number {
  return Math.round(((2 * distanceToRouteKm) / DETOUR_SPEED_KMH) * 60);
}

/** Corridor half-width implied by the accepted detour budget. */
export function corridorHalfWidthKm(detourBudgetMinutes: number): number {
  return (detourBudgetMinutes / 2 / 60) * DETOUR_SPEED_KMH;
}

/**
 * Downsample a polyline to at most `maxPoints`, keeping endpoints.
 * Used to keep the route payload sent to the corridor RPC small; a km-wide
 * corridor tolerates skipped vertices.
 */
export function downsampleLine(
  line: LineStringCoordinates,
  maxPoints: number,
): LineStringCoordinates {
  if (line.length <= maxPoints || maxPoints < 2) return line;
  const step = (line.length - 1) / (maxPoints - 1);
  const result: LineStringCoordinates = [];
  for (let i = 0; i < maxPoints; i += 1) {
    result.push(line[Math.round(i * step)]);
  }
  result[result.length - 1] = line[line.length - 1];
  return result;
}

export type BoundingBox = { ne: [number, number]; sw: [number, number] };

/** Bounding box of a set of positions, expanded by `paddingKm` on each side. */
export function expandedBoundsOf(
  positions: LineStringCoordinates,
  paddingKm: number,
): BoundingBox | null {
  if (positions.length === 0) return null;

  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of positions) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  const midLat = (minLat + maxLat) / 2;
  const latPadding = paddingKm / ((Math.PI * EARTH_RADIUS_KM) / 180);
  const lonPadding =
    paddingKm / (((Math.PI * EARTH_RADIUS_KM) / 180) * Math.max(0.2, Math.cos(toRad(midLat))));

  return {
    sw: [minLon - lonPadding, minLat - latPadding],
    ne: [maxLon + lonPadding, maxLat + latPadding],
  };
}
