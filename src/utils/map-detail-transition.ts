export type ScreenRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const MAP_DETAIL_DISMISS_DISTANCE_RATIO = 0.22;
export const MAP_DETAIL_DISMISS_VELOCITY = 720;
export const MAP_DETAIL_SLIDE_OFFSET_RATIO = 0.16;
export const MAP_DETAIL_SLIDE_OFFSET_MIN = 96;
export const MAP_DETAIL_SLIDE_OFFSET_MAX = 160;

export function getMapDetailSlideOffset(screenHeight: number) {
  if (!(screenHeight > 0)) return MAP_DETAIL_SLIDE_OFFSET_MIN;
  return Math.min(
    MAP_DETAIL_SLIDE_OFFSET_MAX,
    Math.max(
      MAP_DETAIL_SLIDE_OFFSET_MIN,
      Math.round(screenHeight * MAP_DETAIL_SLIDE_OFFSET_RATIO),
    ),
  );
}

export function shouldCompleteMapDetailDismiss(
  translationY: number,
  velocityY: number,
  screenHeight: number,
) {
  const distanceThreshold = Math.max(
    120,
    screenHeight * MAP_DETAIL_DISMISS_DISTANCE_RATIO,
  );
  return (
    translationY >= distanceThreshold ||
    velocityY >= MAP_DETAIL_DISMISS_VELOCITY
  );
}

export function isUsableTransitionRect(rect: ScreenRect | null | undefined) {
  return Boolean(
    rect &&
      Number.isFinite(rect.x) &&
      Number.isFinite(rect.y) &&
      rect.width > 0 &&
      rect.height > 0,
  );
}
