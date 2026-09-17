import type { MapBounds } from '@/types/map-events';

export type SheetCameraSnapshot = {
  longitude: number;
  latitude: number;
  zoom: number;
};

export type SheetCameraAnchor = {
  snapshot: SheetCameraSnapshot;
  rawBounds: MapBounds;
};

export const cloneSheetCameraSnapshot = (
  snapshot: SheetCameraSnapshot,
): SheetCameraSnapshot => ({
  longitude: snapshot.longitude,
  latitude: snapshot.latitude,
  zoom: snapshot.zoom,
});

export const cloneMapBounds = (bounds: MapBounds): MapBounds => ({
  ne: [bounds.ne[0], bounds.ne[1]],
  sw: [bounds.sw[0], bounds.sw[1]],
});

/** Peek → expanded: capture once. Never recapture after the first settle. */
export const shouldCaptureSheetCameraAnchor = (
  targetIndex: number,
  hasSnapshot: boolean,
): boolean => targetIndex > 0 && !hasSnapshot;

export const shouldRestoreSheetCameraAnchor = (targetIndex: number): boolean =>
  targetIndex === 0;

/**
 * Camera fit must use the peek-time raw Mapbox bounds.
 * Query / overlay-inset bounds are a different quantity — never a fallback.
 */
export const resolveSheetCameraFitBounds = (
  anchorRawBounds: MapBounds | null,
): MapBounds | null => (anchorRawBounds ? cloneMapBounds(anchorRawBounds) : null);

/**
 * Max share of the map column used as Mapbox bottom padding when the sheet
 * follows the camera (half snap). The list snap (`VIEWPORT_HALF_RATIO`) can be
 * taller: leftover overlay covers the frozen viewport instead of forcing a
 * huge zoom-out.
 */
export const SHEET_CAMERA_PADDING_MAX_RATIO = 0.42;

export const getSheetCameraPaddingBottom = (
  sheetHeight: number,
  layoutHeight: number,
  fitPadding: number,
): number => {
  const overlay = Math.max(0, sheetHeight);
  const cap = layoutHeight > 0 ? layoutHeight * SHEET_CAMERA_PADDING_MAX_RATIO : overlay;
  return Math.round(Math.min(overlay, cap) + Math.max(0, fitPadding));
};
