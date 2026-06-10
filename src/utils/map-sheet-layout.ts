import { Dimensions } from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;

/** Expo tab bar height (hidden on map screen). */
export const TAB_BAR_HEIGHT = 76;

/** Airbnb-like peek: count strip only. */
export const VIEWPORT_PEEK_HEIGHT = 72;
export const VIEWPORT_PEEK_SNAP = String(VIEWPORT_PEEK_HEIGHT);
/** Mid snap: header + horizontal cards (~half screen). */
export const VIEWPORT_MID_SNAP = '48%';
/** Full list snap. */
export const VIEWPORT_FULL_SNAP = '90%';
export const VIEWPORT_PEEK_RATIO = VIEWPORT_PEEK_HEIGHT / SCREEN_HEIGHT;

export const MAP_CAMERA_ANIMATION_MS = 300;
export const MAP_CAMERA_FOCUS_EXTRA_PADDING = 16;

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
  return [
    VIEWPORT_PEEK_HEIGHT,
    Math.round(layoutHeight * 0.48),
    Math.round(layoutHeight * 0.9),
  ];
};

export const getMapSlotHeight = (layoutHeight: number, sheetHeight: number) => {
  return Math.max(0, layoutHeight - sheetHeight);
};

export const getInitialSheetHeight = (layoutHeight: number, mode: MapSheetMode) => {
  return getSheetSnapHeights(layoutHeight, mode)[0] ?? VIEWPORT_PEEK_HEIGHT;
};
