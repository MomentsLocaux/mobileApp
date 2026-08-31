import type { EventTimeScope } from '@/utils/event-time-scope';
import type { MapBounds } from '@/types/map-events';

type BboxParams = {
  ne: [number, number];
  sw: [number, number];
  limit: number;
};

export const RPC_CLIENT_TIMEOUT_MS = 4000;
export const MAX_MAP_BBOX_DIAMETER_KM = 200;

const KM_PER_LATITUDE_DEGREE = 111;

/**
 * Approximate the longest side of a bbox in kilometres. This deliberately uses
 * the same 111 km/degree convention as `getBoundsFromRadiusKm`, so a 100 km
 * radius produces a 200 km bbox and remains exactly on the accepted boundary.
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
