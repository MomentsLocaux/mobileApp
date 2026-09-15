export type MapSheetMode = 'single' | 'viewport';

export const VIEWPORT_PEEK_HEIGHT = 72;
export const VIEWPORT_HALF_RATIO = 0.55;
export const VIEWPORT_FULL_RATIO = 0.92;
export const VIEWPORT_HALF_SNAP_INDEX = 1;
export const VIEWPORT_FULL_SNAP_INDEX = 2;

export const MAP_TAB_BAR_REVEAL_START_PROGRESS = 0.04;
export const MAP_TAB_BAR_REVEAL_END_PROGRESS = 0.56;

export const getSheetSnapHeights = (
  layoutHeight: number,
  mode: MapSheetMode,
): number[] => {
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
  const snaps = getSheetSnapHeights(layoutHeight, mode);
  if (snaps.length <= 1) return 0;

  if (velocityY < -0.45) {
    const above = snaps.findIndex((height) => height > sheetHeight + 8);
    return above >= 0 ? above : snaps.length - 1;
  }
  if (velocityY > 0.45) {
    const below = [...snaps].reverse().findIndex((height) => height < sheetHeight - 8);
    return below >= 0 ? snaps.length - 1 - below : 0;
  }

  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  snaps.forEach((height, index) => {
    const distance = Math.abs(height - sheetHeight);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
};
