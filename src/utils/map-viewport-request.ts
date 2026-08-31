import type { MapBounds } from '@/types/map-events';

/** Stable key for deduplicating identical viewport fetches while one is in flight. */
export const buildViewportBoundsKey = (bounds: MapBounds, limit: number) =>
  [bounds.ne[0], bounds.ne[1], bounds.sw[0], bounds.sw[1], limit].join('|');

export type ViewportRequestTracker = {
  currentId: number;
  inFlightKey: string | null;
};

export const createViewportRequestTracker = (): ViewportRequestTracker => ({
  currentId: 0,
  inFlightKey: null,
});

export const nextViewportRequest = (tracker: ViewportRequestTracker) => {
  tracker.currentId += 1;
  return tracker.currentId;
};

export const isViewportRequestCurrent = (tracker: ViewportRequestTracker, requestId: number) =>
  requestId === tracker.currentId;

export const shouldSkipDuplicateViewportFetch = (
  inFlightKey: string | null,
  boundsKey: string,
  options?: { force?: boolean }
) => !options?.force && inFlightKey === boundsKey;
