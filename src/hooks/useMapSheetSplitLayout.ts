import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  cancelAnimation,
  runOnJS,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {
  clampSheetHeight,
  getInitialSheetHeight,
  getMaxSheetHeight,
  getSheetMaxSnapIndex,
  getSheetSnapHeights,
  resolveSheetHeightForLayout,
  resolveSheetSnapIndex,
  SHEET_SPRING_CONFIG,
  sheetHeightToProgress,
  type MapSheetMode,
  VIEWPORT_PEEK_HEIGHT,
} from '@/utils/map-sheet-layout';
import { traceMapSheetPerf } from '@/utils/map-sheet-perf-trace';
import { useReduceMotion } from '@/hooks/useReduceMotion';

export function useMapSheetSplitLayout(mode: MapSheetMode, snapIndex = 0) {
  const reduceMotion = useReduceMotion();
  const layoutHeightRef = useRef(0);
  const isSheetDraggingRef = useRef(false);
  const dragOriginSheetHeightRef = useRef(VIEWPORT_PEEK_HEIGHT);
  const onSettledRef = useRef<(() => void) | null>(null);
  const snapIndexRef = useRef(snapIndex);
  snapIndexRef.current = snapIndex;

  const layoutHeightShared = useSharedValue(0);
  const minSheetHeightShared = useSharedValue(VIEWPORT_PEEK_HEIGHT);
  const maxSheetHeightShared = useSharedValue(0);
  /** Visible sheet height in px — drives overlay translateY only (no Mapbox resize). */
  const sheetVisibleHeight = useSharedValue(VIEWPORT_PEEK_HEIGHT);
  /** 0 = peek, 1 = fully expanded — shared visual orchestration source. */
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

      if (!animated || reduceMotion) {
        onSettledRef.current = null;
        sheetVisibleHeight.value = clamped;
        sheetProgress.value = progress;
        onSettled?.();
        return;
      }

      onSettledRef.current = onSettled ?? null;
      sheetVisibleHeight.value = withSpring(clamped, SHEET_SPRING_CONFIG);
      sheetProgress.value = withSpring(progress, SHEET_SPRING_CONFIG, (finished) => {
        'worklet';
        if (!finished) return;
        runOnJS(flushOnSettled)();
      });
    },
    [flushOnSettled, mode, reduceMotion, sheetProgress, sheetVisibleHeight]
  );

  const handleColumnLayout = useCallback(
    (height: number) => {
      if (height <= 0 || height === layoutHeightRef.current) return;
      const previousHeight = layoutHeightRef.current;
      const visualSnap =
        previousHeight > 0
          ? resolveSheetSnapIndex(sheetVisibleHeight.value, previousHeight, mode)
          : snapIndexRef.current;
      const keepSnap = Math.max(snapIndexRef.current, visualSnap);

      layoutHeightRef.current = height;
      layoutHeightShared.value = height;
      maxSheetHeightShared.value = getMaxSheetHeight(height, mode);
      minSheetHeightShared.value = getInitialSheetHeight(height, mode);

      if (isSheetDraggingRef.current) return;

      cancelAnimation(sheetVisibleHeight);
      cancelAnimation(sheetProgress);
      const targetSheet = resolveSheetHeightForLayout(height, mode, keepSnap);
      const progress = sheetHeightToProgress(targetSheet, height, mode);
      sheetVisibleHeight.value = targetSheet;
      sheetProgress.value = progress;
    },
    [
      layoutHeightShared,
      maxSheetHeightShared,
      minSheetHeightShared,
      mode,
      sheetProgress,
      sheetVisibleHeight,
    ]
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
      const layoutHeight = layoutHeightRef.current;
      if (layoutHeight <= 0) return null;
      const nextSheet = clampSheetHeight(
        dragOriginSheetHeightRef.current - dy,
        layoutHeight,
        mode
      );
      sheetVisibleHeight.value = nextSheet;
      sheetProgress.value = sheetHeightToProgress(nextSheet, layoutHeight, mode);
      return nextSheet;
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
      return targetIndex;
    },
    [mode]
  );

  const previousModeRef = useRef(mode);
  const layoutReadyRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const restoreStableSnap = (flushPendingCallback: boolean) => {
      const layoutHeight = layoutHeightRef.current;
      if (layoutHeight <= 0) return;

      cancelAnimation(sheetVisibleHeight);
      cancelAnimation(sheetProgress);
      isSheetDraggingRef.current = false;

      const clampedSnap = Math.min(
        Math.max(0, snapIndex),
        getSheetMaxSnapIndex(mode),
      );
      const targetSheet = getSheetSnapHeights(layoutHeight, mode)[clampedSnap];
      if (targetSheet == null) return;

      sheetVisibleHeight.value = targetSheet;
      sheetProgress.value = sheetHeightToProgress(targetSheet, layoutHeight, mode);
      traceMapSheetPerf('restoreSheetAfterAppStateChange', {
        appState: appStateRef.current,
        snapIndex: clampedSnap,
      });

      if (flushPendingCallback) {
        flushOnSettled();
      }
    };

    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState !== 'active') {
        restoreStableSnap(false);
        return;
      }
      if (previousState !== 'active') {
        restoreStableSnap(true);
      }
    });

    return () => subscription.remove();
  }, [
    flushOnSettled,
    mode,
    sheetProgress,
    sheetVisibleHeight,
    snapIndex,
  ]);

  useEffect(() => {
    const layoutHeight = layoutHeightRef.current;
    if (layoutHeight <= 0 || isSheetDraggingRef.current) return;

    const modeChanged = previousModeRef.current !== mode;
    previousModeRef.current = mode;

    const isFirstLayout = !layoutReadyRef.current;
    layoutReadyRef.current = true;
    if (!modeChanged && !isFirstLayout) return;

    maxSheetHeightShared.value = getMaxSheetHeight(layoutHeight, mode);
    minSheetHeightShared.value = getInitialSheetHeight(layoutHeight, mode);
    const clampedSnap = Math.min(Math.max(0, snapIndex), getSheetMaxSnapIndex(mode));
    const targetSheet = getSheetSnapHeights(layoutHeight, mode)[clampedSnap];
    if (targetSheet == null) return;

    applySheetVisibleHeight(targetSheet, false);
  }, [
    applySheetVisibleHeight,
    maxSheetHeightShared,
    minSheetHeightShared,
    mode,
    snapIndex,
  ]);

  return {
    layoutHeightShared,
    minSheetHeightShared,
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
