/** iOS Simulator default coords — treated as "no real GPS". */
export const SIM_FALLBACK_COORDS = { latitude: 37.785834, longitude: -122.406417 };

/** Bottom padding passed to `focusOnCoordinate` for event focus. */
export const MAP_FOCUS_PADDING_BOTTOM = 20;

/** Uniform fit padding for bounds fitting. */
export const MAP_FIT_PADDING = 20;

export const MAP_VIEW_PADDING = {
  top: MAP_FIT_PADDING,
  right: MAP_FIT_PADDING,
  bottom: MAP_FIT_PADDING,
  left: MAP_FIT_PADDING,
} as const;

/** Metropolitan France + Corsica, slightly padded for border-area browsing. */
export const FRANCE_CAMERA_BOUNDS = {
  sw: [-8.5, 40.0],
  ne: [11.8, 52.8],
} as const;

/** Overview camera when GPS and an explicit searched place are both missing. */
export const FRANCE_CAMERA_CENTER = {
  latitude: (FRANCE_CAMERA_BOUNDS.sw[1] + FRANCE_CAMERA_BOUNDS.ne[1]) / 2,
  longitude: (FRANCE_CAMERA_BOUNDS.sw[0] + FRANCE_CAMERA_BOUNDS.ne[0]) / 2,
  zoom: 5.2,
} as const;

/** Street-level zoom used for GPS or an explicit searched place. */
export const MAP_LOCAL_ZOOM = 12;
