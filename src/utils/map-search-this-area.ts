import type { MapBounds } from '@/types/map-events';
import { normalizeMapBounds } from './map-bounds';

/** Fraction of the last searched span the center must move before offering a refresh. */
export const SEARCH_THIS_AREA_CENTER_SHIFT_RATIO = 0.22;

/** Absolute zoom delta that always counts as “moved enough”. */
export const SEARCH_THIS_AREA_ZOOM_DELTA = 0.85;

export function boundsCenter(bounds: MapBounds): { lon: number; lat: number } {
  const b = normalizeMapBounds(bounds);
  return {
    lon: (b.sw[0] + b.ne[0]) / 2,
    lat: (b.sw[1] + b.ne[1]) / 2,
  };
}

export function boundsSpan(bounds: MapBounds): { lon: number; lat: number } {
  const b = normalizeMapBounds(bounds);
  return {
    lon: Math.max(b.ne[0] - b.sw[0], 1e-9),
    lat: Math.max(b.ne[1] - b.sw[1], 1e-9),
  };
}

/**
 * True when the camera left the last searched zone enough to warrant
 * “Rechercher dans cette zone” (Airbnb / Google Maps pattern).
 */
export function hasLeftSearchedZone(
  searched: MapBounds | null | undefined,
  current: MapBounds,
  options?: {
    searchedZoom?: number | null;
    currentZoom?: number | null;
    centerShiftRatio?: number;
    zoomDelta?: number;
  }
): boolean {
  if (!searched) return false;

  const centerShiftRatio = options?.centerShiftRatio ?? SEARCH_THIS_AREA_CENTER_SHIFT_RATIO;
  const zoomDelta = options?.zoomDelta ?? SEARCH_THIS_AREA_ZOOM_DELTA;

  const searchedZoom = options?.searchedZoom;
  const currentZoom = options?.currentZoom;
  if (
    typeof searchedZoom === 'number' &&
    typeof currentZoom === 'number' &&
    Number.isFinite(searchedZoom) &&
    Number.isFinite(currentZoom) &&
    Math.abs(currentZoom - searchedZoom) >= zoomDelta
  ) {
    return true;
  }

  const from = boundsCenter(searched);
  const to = boundsCenter(current);
  const span = boundsSpan(searched);
  const shiftLon = Math.abs(to.lon - from.lon) / span.lon;
  const shiftLat = Math.abs(to.lat - from.lat) / span.lat;

  return shiftLon >= centerShiftRatio || shiftLat >= centerShiftRatio;
}
