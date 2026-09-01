import type { EventTimeScope } from '@/utils/event-time-scope';
import type { MapBounds } from '@/types/map-events';

type BboxParams = {
  ne: [number, number];
  sw: [number, number];
  limit: number;
};

export const RPC_CLIENT_TIMEOUT_MS = 4000;
export const MAX_MAP_BBOX_DIAMETER_KM = 300;
/**
 * Auto-zoom target after tapping "zone trop large" (~40 km radius, same
 * scale as the "À proximité" search). Kept far below the 300 km fetch cap so
 * the camera actually moves when the viewport was only slightly oversized.
 */
export const MAP_BBOX_TIGHTEN_DIAMETER_KM = 80;

const KM_PER_LATITUDE_DEGREE = 111;

/**
 * Approximate the longest side of a bbox in kilometres. This deliberately uses
 * the same 111 km/degree convention as `getBoundsFromRadiusKm`, so a 150 km
 * radius produces a 300 km bbox and remains exactly on the accepted boundary.
 */
export function getMapBoundsDiameterKm(bounds: MapBounds): number {
  const latitudeSpanKm = Math.abs(bounds.ne[1] - bounds.sw[1]) * KM_PER_LATITUDE_DEGREE;
  const middleLatitude = (bounds.ne[1] + bounds.sw[1]) / 2;
  const longitudeSpanDegrees = Math.abs(bounds.ne[0] - bounds.sw[0]);
  const longitudeSpanKm =
    longitudeSpanDegrees *
    KM_PER_LATITUDE_DEGREE *
    Math.max(Math.cos((middleLatitude * Math.PI) / 180), 0.1);
  return Math.max(latitudeSpanKm, longitudeSpanKm);
}

export function isMapBoundsTooLarge(
  bounds: MapBounds,
  maxDiameterKm = MAX_MAP_BBOX_DIAMETER_KM
): boolean {
  return getMapBoundsDiameterKm(bounds) > maxDiameterKm + 0.01;
}

/**
 * Scale a bbox around its center until its longest side is at most
 * `maxDiameterKm`. Bounds that are already small enough are returned as-is.
 */
export function shrinkMapBoundsToMaxDiameter(
  bounds: MapBounds,
  maxDiameterKm = MAP_BBOX_TIGHTEN_DIAMETER_KM
): MapBounds {
  const diameterKm = getMapBoundsDiameterKm(bounds);
  if (!(diameterKm > 0) || !Number.isFinite(diameterKm) || !(maxDiameterKm > 0)) {
    return bounds;
  }
  if (diameterKm <= maxDiameterKm + 0.01) return bounds;

  const scale = maxDiameterKm / diameterKm;
  const centerLon = (bounds.ne[0] + bounds.sw[0]) / 2;
  const centerLat = (bounds.ne[1] + bounds.sw[1]) / 2;
  const halfLon = Math.abs(bounds.ne[0] - bounds.sw[0]) * 0.5 * scale;
  const halfLat = Math.abs(bounds.ne[1] - bounds.sw[1]) * 0.5 * scale;

  return {
    sw: [centerLon - halfLon, centerLat - halfLat],
    ne: [centerLon + halfLon, centerLat + halfLat],
  };
}

const MAX_BOTTOM_OVERLAY_COVER_RATIO = 0.85;

/**
 * Shrink the south edge of a north-up bbox so events under a bottom overlay
 * (peek / sheet) are not part of the viewport fetch.
 */
export function insetMapBoundsForBottomOverlay(
  bounds: MapBounds,
  options: { mapHeightPx: number; overlayBottomPx: number }
): MapBounds {
  const mapHeightPx = options.mapHeightPx;
  const overlayBottomPx = options.overlayBottomPx;
  if (!(mapHeightPx > 0) || !(overlayBottomPx > 0)) return bounds;

  const coverRatio = Math.min(overlayBottomPx / mapHeightPx, MAX_BOTTOM_OVERLAY_COVER_RATIO);
  if (!(coverRatio > 0)) return bounds;

  const latSpan = bounds.ne[1] - bounds.sw[1];
  if (!(latSpan > 0)) return bounds;

  const nextSouth = bounds.sw[1] + latSpan * coverRatio;
  if (nextSouth >= bounds.ne[1]) return bounds;

  return {
    ne: bounds.ne,
    sw: [bounds.sw[0], nextSouth],
  };
}

/** Ignore tiny camera settle differences when deciding whether a searched area changed. */
export function haveMapBoundsMeaningfullyChanged(
  committed: MapBounds | null,
  visible: MapBounds
): boolean {
  if (!committed) return true;
  const committedWidth = Math.max(Math.abs(committed.ne[0] - committed.sw[0]), 1e-6);
  const committedHeight = Math.max(Math.abs(committed.ne[1] - committed.sw[1]), 1e-6);
  const toleranceLon = Math.max(committedWidth * 0.02, 1e-4);
  const toleranceLat = Math.max(committedHeight * 0.02, 1e-4);
  return (
    Math.abs(committed.ne[0] - visible.ne[0]) > toleranceLon ||
    Math.abs(committed.ne[1] - visible.ne[1]) > toleranceLat ||
    Math.abs(committed.sw[0] - visible.sw[0]) > toleranceLon ||
    Math.abs(committed.sw[1] - visible.sw[1]) > toleranceLat
  );
}

export type ViewportCacheDisposition = 'fresh' | 'stale' | 'expired';

export const getViewportCacheDisposition = (
  storedAt: number,
  now: number,
  freshMs: number,
  maxStaleMs: number
): ViewportCacheDisposition => {
  const ageMs = Math.max(0, now - storedAt);
  if (ageMs <= freshMs) return 'fresh';
  if (ageMs <= maxStaleMs) return 'stale';
  return 'expired';
};

export const buildMapViewportCacheKey = (
  bbox: BboxParams,
  timeScope: EventTimeScope,
  options?: { mergeUpcomingForDatePreset?: boolean }
) =>
  [
    bbox.ne[0],
    bbox.ne[1],
    bbox.sw[0],
    bbox.sw[1],
    bbox.limit,
    timeScope,
    options?.mergeUpcomingForDatePreset ? 1 : 0,
  ].join('|');

/** Race against a client timeout and always clear the timer when the RPC settles first. */
export async function raceWithViewportTimeout<T>(
  promise: Promise<T>,
  timeoutMs = RPC_CLIENT_TIMEOUT_MS
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(Object.assign(new Error('list_map_viewport client timeout'), { code: '57014' }));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
