import { Dimensions } from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;

/** Expo tab bar height (shown below map + sheet on map screen). */
export const TAB_BAR_HEIGHT = 76;

/** Rounded junction between map slot and sheet slot. */
export const SHEET_JUNCTION_RADIUS = 16;

/** Airbnb-like peek: count strip only. */
export const VIEWPORT_PEEK_HEIGHT = 72;
export const VIEWPORT_PEEK_SNAP = String(VIEWPORT_PEEK_HEIGHT);

/** Mid snap: ~half screen with event bubble. */
export const VIEWPORT_MID_SNAP = '50%';

/** Full list snap. */
export const VIEWPORT_FULL_SNAP = '92%';
export const VIEWPORT_PEEK_RATIO = VIEWPORT_PEEK_HEIGHT / SCREEN_HEIGHT;

export const MAP_CAMERA_ANIMATION_MS = 300;
export const MAP_CAMERA_FOCUS_EXTRA_PADDING = 16;

/** Smooth snap — low stiffness to avoid jank after drag. */
export const SHEET_SPRING_CONFIG = {
  damping: 24,
  stiffness: 210,
  mass: 0.72,
  overshootClamping: false,
};

export type MapSheetMode = 'single' | 'viewport';

export const getScreenHeight = () => SCREEN_HEIGHT;

export const getTabContentHeight = () => SCREEN_HEIGHT - TAB_BAR_HEIGHT;

/** Absolute sheet body heights for a measured layout column. */
export const getSheetSnapHeights = (layoutHeight: number, mode: MapSheetMode): number[] => {
  if (layoutHeight <= 0) {
    return mode === 'single'
      ? [VIEWPORT_PEEK_HEIGHT, VIEWPORT_PEEK_HEIGHT]
      : [VIEWPORT_PEEK_HEIGHT, VIEWPORT_PEEK_HEIGHT, VIEWPORT_PEEK_HEIGHT];
  }
  if (mode === 'single') {
    return [Math.round(layoutHeight * 0.16), Math.round(layoutHeight * 0.47)];
  }
  const mid = Math.round(layoutHeight * 0.5);
  return [
    VIEWPORT_PEEK_HEIGHT,
    mid,
    Math.round(layoutHeight * 0.92),
  ];
};

export const getMapSlotHeight = (layoutHeight: number, sheetHeight: number) => {
  return Math.max(0, layoutHeight - sheetHeight);
};

export const getInitialSheetHeight = (layoutHeight: number, mode: MapSheetMode) => {
  return getSheetSnapHeights(layoutHeight, mode)[0] ?? VIEWPORT_PEEK_HEIGHT;
};

export const clampSheetHeight = (height: number, layoutHeight: number, mode: MapSheetMode) => {
  const snaps = getSheetSnapHeights(layoutHeight, mode);
  if (!snaps.length) return VIEWPORT_PEEK_HEIGHT;
  const min = snaps[0];
  const max = snaps[snaps.length - 1];
  return Math.min(max, Math.max(min, height));
};

export const resolveSheetSnapIndex = (
  sheetHeight: number,
  layoutHeight: number,
  mode: MapSheetMode,
  velocityY = 0
) => {
  const snaps = getSheetSnapHeights(layoutHeight, mode);
  if (snaps.length <= 1) return 0;

  if (velocityY < -0.45) {
    const above = snaps.findIndex((h) => h > sheetHeight + 8);
    return above >= 0 ? above : snaps.length - 1;
  }
  if (velocityY > 0.45) {
    const below = [...snaps].reverse().findIndex((h) => h < sheetHeight - 8);
    return below >= 0 ? snaps.length - 1 - below : 0;
  }

  let bestIdx = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  snaps.forEach((height, index) => {
    const dist = Math.abs(height - sheetHeight);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = index;
    }
  });
  return bestIdx;
};
