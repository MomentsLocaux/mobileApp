import { Dimensions } from 'react-native';
import { Motion } from '@/constants/motion';
import {
  getSheetSnapHeights,
  type MapSheetMode,
  VIEWPORT_PEEK_HEIGHT,
} from './map-sheet-physics';

export {
  getSheetMaxSnapIndex,
  getSheetSnapHeights,
  MAP_TAB_BAR_REVEAL_END_PROGRESS,
  MAP_TAB_BAR_REVEAL_START_PROGRESS,
  resolveMapTabBarProgress,
  resolveSheetHeightForLayout,
  resolveSheetSnapIndex,
  resolveSheetSnapTarget,
  resolveEffectiveSheetSnapIndex,
  sheetHeightToProgress,
  sheetSnapIndexWhenOpeningRefine,
  VIEWPORT_FULL_RATIO,
  VIEWPORT_FULL_SNAP_INDEX,
  VIEWPORT_HALF_SNAP_INDEX,
  VIEWPORT_PEEK_HEIGHT,
  VIEWPORT_PEEK_SNAP_INDEX,
} from './map-sheet-physics';
export type { MapSheetMode } from './map-sheet-physics';

const SCREEN_HEIGHT = Dimensions.get('window').height;

/** Expo tab bar height (shown below map + sheet on map screen). */
export const TAB_BAR_HEIGHT = 76;

/** Rounded junction between map slot and sheet slot. */
export const SHEET_JUNCTION_RADIUS = 16;

/** Closed sheet: handle + « X Moments dans la zone ». */
export const VIEWPORT_PEEK_SNAP = String(VIEWPORT_PEEK_HEIGHT);

/** Expanded snap: full list. */
export const VIEWPORT_FULL_SNAP = '92%';
export const VIEWPORT_PEEK_RATIO = VIEWPORT_PEEK_HEIGHT / SCREEN_HEIGHT;

export const MAP_CAMERA_ANIMATION_MS = 300;
export const MAP_CAMERA_FOCUS_EXTRA_PADDING = 16;

/** Sheet snap spring — aligned with Motion.spring.sheet. */
export const SHEET_SPRING_CONFIG = {
  ...Motion.spring.sheet,
  overshootClamping: true,
};

/** Layout resize timing — kept in sync with map camera refit duration. */
export const SHEET_LAYOUT_TIMING = {
  duration: Motion.duration.normal,
  easing: Motion.easing.emphasized,
};

export const getScreenHeight = () => SCREEN_HEIGHT;

export const getTabContentHeight = () => SCREEN_HEIGHT - TAB_BAR_HEIGHT;

/**
 * Viewport peek/full never reculs the map: peek already shows the pins, full covers them.
 * The single-event sheet still fits the pin into the remaining map slot.
 */
export function shouldFollowMapCameraForSheetIndex(
  snapIndex: number,
  mode: MapSheetMode
): boolean {
  if (snapIndex <= 0) return false;
  return mode === 'single';
}

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

export const getMaxSheetHeight = (layoutHeight: number, mode: MapSheetMode) => {
  const snaps = getSheetSnapHeights(layoutHeight, mode);
  return snaps[snaps.length - 1] ?? VIEWPORT_PEEK_HEIGHT;
};

export const progressToSheetHeight = (
  progress: number,
  layoutHeight: number,
  mode: MapSheetMode
): number => {
  const peek = getSheetSnapHeights(layoutHeight, mode)[0] ?? VIEWPORT_PEEK_HEIGHT;
  const max = getMaxSheetHeight(layoutHeight, mode);
  return peek + Math.min(1, Math.max(0, progress)) * (max - peek);
};
