/** Default map focus when user location is unavailable. */
export const FONTOY_COORDS = { latitude: 49.3247, longitude: 5.9947 };

/** iOS Simulator default coords — treated as "no real GPS". */
export const SIM_FALLBACK_COORDS = { latitude: 37.785834, longitude: -122.406417 };

/** Bottom padding passed to `focusOnCoordinate` for event focus. */
export const MAP_FOCUS_PADDING_BOTTOM = 20;

/** Uniform fit padding for bounds fitting. */
export const MAP_FIT_PADDING = 20;

/**
 * Locate FAB / first GPS center — neighborhood disk (clamped product band: 1–20 km).
 * Kept tighter than DISCOVERY_DEFAULT_RADIUS_KM (20) so “ma position” feels close.
 */
export const MAP_RECENTER_USER_RADIUS_KM = 5;

/** Clamp any locate/search camera radius into the supported 1–20 km band. */
export function clampMapRecenterRadiusKm(radiusKm: number): number {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) return MAP_RECENTER_USER_RADIUS_KM;
  return Math.min(20, Math.max(1, radiusKm));
}

export const MAP_VIEW_PADDING = {
  top: MAP_FIT_PADDING,
  right: MAP_FIT_PADDING,
  bottom: MAP_FIT_PADDING,
  left: MAP_FIT_PADDING,
} as const;

/**
 * Pixel chrome removed from getVisibleBounds before RPC / peek count.
 * Bottom matches the peek sheet overlay (map is full-bleed underneath).
 * Edges avoid counting markers clipped at the screen rim.
 * Peek inset must stay aligned with VIEWPORT_PEEK_HEIGHT in map-sheet-layout.
 */
export const MAP_QUERY_EDGE_INSET_PX = 18;
export const MAP_QUERY_PEEK_INSET_PX = 72;
/** Extra gap above the peek strip so events on the sheet lip are excluded. */
export const MAP_QUERY_PEEK_GAP_PX = 8;

/** Metropolitan France + Corsica, slightly padded for border-area browsing. */
export const FRANCE_CAMERA_BOUNDS = {
  sw: [-8.5, 40.0],
  ne: [11.8, 52.8],
} as const;
