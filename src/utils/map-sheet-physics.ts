export type MapSheetMode = 'single' | 'viewport';

export const VIEWPORT_PEEK_HEIGHT = 104;
export const VIEWPORT_HALF_RATIO = 0.55;
export const VIEWPORT_FULL_RATIO = 0.92;
export const VIEWPORT_HALF_SNAP_INDEX = 1;
export const VIEWPORT_FULL_SNAP_INDEX = 2;

export const MAP_TAB_BAR_REVEAL_START_PROGRESS = 0.15;
export const MAP_TAB_BAR_REVEAL_END_PROGRESS = 0.56;
export const SHEET_INERTIA_PROJECTION_MS = 220;

export const getSheetSnapHeights = (
  layoutHeight: number,
  mode: MapSheetMode,
): number[] => {
  'worklet';
  if (layoutHeight <= 0) {
    return [VIEWPORT_PEEK_HEIGHT, VIEWPORT_PEEK_HEIGHT];
  }
  if (mode === 'single') {
    return [Math.round(layoutHeight * 0.16), Math.round(layoutHeight * 0.47)];
  }
  return [
    VIEWPORT_PEEK_HEIGHT,
    Math.round(layoutHeight * VIEWPORT_HALF_RATIO),
    Math.round(layoutHeight * VIEWPORT_FULL_RATIO),
  ];
};

export const sheetHeightToProgress = (
  sheetHeight: number,
  layoutHeight: number,
  mode: MapSheetMode,
): number => {
  'worklet';
  const snaps = getSheetSnapHeights(layoutHeight, mode);
  const peek = snaps[0] ?? VIEWPORT_PEEK_HEIGHT;
  const max = snaps[snaps.length - 1] ?? VIEWPORT_PEEK_HEIGHT;
  const range = Math.max(1, max - peek);
  return Math.min(1, Math.max(0, (sheetHeight - peek) / range));
};

export const getSheetMaxSnapIndex = (mode: MapSheetMode) =>
  mode === 'single' ? 1 : VIEWPORT_FULL_SNAP_INDEX;

export const resolveMapTabBarProgress = (sheetProgress: number): number => {
  'worklet';
  const range =
    MAP_TAB_BAR_REVEAL_END_PROGRESS - MAP_TAB_BAR_REVEAL_START_PROGRESS;
  if (range <= 0) return sheetProgress > MAP_TAB_BAR_REVEAL_START_PROGRESS ? 1 : 0;
  return Math.min(
    1,
    Math.max(0, (sheetProgress - MAP_TAB_BAR_REVEAL_START_PROGRESS) / range),
  );
};

export const resolveSheetSnapIndex = (
  sheetHeight: number,
  layoutHeight: number,
  mode: MapSheetMode,
  velocityY = 0,
) => {
  'worklet';
  const snaps = getSheetSnapHeights(layoutHeight, mode);
  const lastIndex = snaps.length - 1;
  if (snaps.length <= 1) return 0;

  const minHeight = snaps[0];
  const maxHeight = snaps[lastIndex];
  const projectedHeight = Math.min(
    maxHeight,
    Math.max(minHeight, sheetHeight - velocityY * SHEET_INERTIA_PROJECTION_MS),
  );

  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < snaps.length; index += 1) {
    const distance = Math.abs(snaps[index] - projectedHeight);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
};

export const resolveSheetSnapTarget = (
  sheetHeight: number,
  layoutHeight: number,
  mode: MapSheetMode,
  velocityY = 0,
) => {
  'worklet';
  const index = resolveSheetSnapIndex(sheetHeight, layoutHeight, mode, velocityY);
  const snaps = getSheetSnapHeights(layoutHeight, mode);
  const height = snaps[index] ?? sheetHeight;
  return {
    index,
    height,
    progress: sheetHeightToProgress(height, layoutHeight, mode),
  };
};
