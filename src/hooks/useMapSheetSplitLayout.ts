import { useCallback, useEffect, useRef } from 'react';
import { runOnJS, useSharedValue, withTiming } from 'react-native-reanimated';
import {
  clampSheetHeight,
  getInitialSheetHeight,
  getMaxSheetHeight,
  getSheetMaxSnapIndex,
  getSheetSnapHeights,
  resolveSheetSnapIndex,
  SHEET_LAYOUT_TIMING,
  sheetHeightToProgress,
  type MapSheetMode,
  VIEWPORT_PEEK_HEIGHT,
} from '@/utils/map-sheet-layout';
import { traceMapSheetPerf } from '@/utils/map-sheet-perf-trace';

export function useMapSheetSplitLayout(mode: MapSheetMode, snapIndex = 0) {
  const layoutHeightRef = useRef(0);
  const isSheetDraggingRef = useRef(false);
  const dragOriginSheetHeightRef = useRef(VIEWPORT_PEEK_HEIGHT);
  const onSettledRef = useRef<(() => void) | null>(null);

  const layoutHeightShared = useSharedValue(0);
  const maxSheetHeightShared = useSharedValue(0);
  /** Visible sheet height in px — drives overlay translateY only (no Mapbox resize). */
  const sheetVisibleHeight = useSharedValue(VIEWPORT_PEEK_HEIGHT);
  /** 0 = peek, 1 = fully expanded — drives map visual recede. */
  const sheetProgress = useSharedValue(0);

  const flushOnSettled = useCallback(() => {
    const callback = onSettledRef.current;
    onSettledRef.current = null;
    callback?.();
  }, []);

  const applySheetVisibleHeight = useCallback(
    (sheetHeight: number, animated = false, onSettled?: () => void) => {
      const layoutHeight = layoutHeightRef.current;
      if (layoutHeight <= 0) return;

      const clamped = clampSheetHeight(sheetHeight, layoutHeight, mode);
      const progress = sheetHeightToProgress(clamped, layoutHeight, mode);

      if (!animated) {
        onSettledRef.current = null;
        sheetVisibleHeight.value = clamped;
        sheetProgress.value = progress;
        onSettled?.();
        return;
      }

      onSettledRef.current = onSettled ?? null;
      sheetVisibleHeight.value = withTiming(clamped, SHEET_LAYOUT_TIMING);
      sheetProgress.value = withTiming(progress, SHEET_LAYOUT_TIMING, (finished) => {
        'worklet';
        if (!finished) return;
        runOnJS(flushOnSettled)();
      });
    },
    [flushOnSettled, mode, sheetProgress, sheetVisibleHeight]
  );

  const handleColumnLayout = useCallback(
    (height: number) => {
      if (height <= 0 || height === layoutHeightRef.current) return;
      layoutHeightRef.current = height;
      layoutHeightShared.value = height;
      maxSheetHeightShared.value = getMaxSheetHeight(height, mode);

      const initialSheet = getInitialSheetHeight(height, mode);
      const progress = sheetHeightToProgress(initialSheet, height, mode);
      sheetVisibleHeight.value = initialSheet;
      sheetProgress.value = progress;
    },
    [layoutHeightShared, maxSheetHeightShared, mode, sheetProgress, sheetVisibleHeight]
  );

  const setSheetSnapIndex = useCallback(
    (index: number, animated = true, onSettled?: () => void) => {
      traceMapSheetPerf('setSheetSnapIndex', { index, animated });
      const layoutHeight = layoutHeightRef.current;
      if (layoutHeight <= 0) return;
      const targetSheet = getSheetSnapHeights(layoutHeight, mode)[index];
      if (targetSheet == null) return;
      applySheetVisibleHeight(targetSheet, animated, onSettled);
    },
    [applySheetVisibleHeight, mode]
  );

  const beginSheetDrag = useCallback(
    (snapIndex: number) => {
      traceMapSheetPerf('beginSheetDrag', { snapIndex });
      const layoutHeight = layoutHeightRef.current;
      if (layoutHeight <= 0) return;
      onSettledRef.current = null;
      const heights = getSheetSnapHeights(layoutHeight, mode);
      const origin = heights[snapIndex] ?? heights[0] ?? VIEWPORT_PEEK_HEIGHT;
      dragOriginSheetHeightRef.current = origin;
      isSheetDraggingRef.current = true;
    },
    [mode]
  );

  const updateSheetDrag = useCallback(
    (dy: number) => {
      traceMapSheetPerf('updateSheetDrag');
      const layoutHeight = layoutHeightRef.current;
      if (layoutHeight <= 0) return;
      const nextSheet = clampSheetHeight(
        dragOriginSheetHeightRef.current - dy,
        layoutHeight,
        mode
      );
      sheetVisibleHeight.value = nextSheet;
      sheetProgress.value = sheetHeightToProgress(nextSheet, layoutHeight, mode);
    },
    [mode, sheetProgress, sheetVisibleHeight]
  );

  const finishSheetDrag = useCallback(
    (dy: number, velocityY: number) => {
      traceMapSheetPerf('finishSheetDrag', { dy, velocityY });
      const layoutHeight = layoutHeightRef.current;
      if (layoutHeight <= 0) return 0;
      isSheetDraggingRef.current = false;

      const currentSheet = clampSheetHeight(
        dragOriginSheetHeightRef.current - dy,
        layoutHeight,
        mode
      );
      const targetIndex = resolveSheetSnapIndex(currentSheet, layoutHeight, mode, velocityY);
      const targetSheet = getSheetSnapHeights(layoutHeight, mode)[targetIndex] ?? currentSheet;
      applySheetVisibleHeight(targetSheet, true);
      return targetIndex;
    },
    [applySheetVisibleHeight, mode]
  );

  const previousModeRef = useRef(mode);
  const layoutReadyRef = useRef(false);

  useEffect(() => {
    const layoutHeight = layoutHeightRef.current;
    if (layoutHeight <= 0 || isSheetDraggingRef.current) return;

    const modeChanged = previousModeRef.current !== mode;
    previousModeRef.current = mode;

    const isFirstLayout = !layoutReadyRef.current;
    layoutReadyRef.current = true;
    if (!modeChanged && !isFirstLayout) return;

    maxSheetHeightShared.value = getMaxSheetHeight(layoutHeight, mode);
    const clampedSnap = Math.min(Math.max(0, snapIndex), getSheetMaxSnapIndex(mode));
    const targetSheet = getSheetSnapHeights(layoutHeight, mode)[clampedSnap];
    if (targetSheet == null) return;

    applySheetVisibleHeight(targetSheet, false);
  }, [applySheetVisibleHeight, maxSheetHeightShared, mode, snapIndex]);

  return {
    layoutHeightShared,
    maxSheetHeightShared,
    sheetVisibleHeight,
    sheetProgress,
    isSheetDraggingRef,
    handleColumnLayout,
    setSheetSnapIndex,
    beginSheetDrag,
    updateSheetDrag,
    finishSheetDrag,
  };
};
