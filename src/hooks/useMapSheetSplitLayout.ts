import { useCallback, useRef, useState } from 'react';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import {
  clampSheetHeight,
  getInitialSheetHeight,
  getMapSlotHeight,
  getScreenHeight,
  getSheetSnapHeights,
  resolveSheetSnapIndex,
  SHEET_SPRING_CONFIG,
  type MapSheetMode,
  VIEWPORT_PEEK_HEIGHT,
} from '@/utils/map-sheet-layout';

const ESTIMATED_LAYOUT_HEIGHT = getScreenHeight();

export function useMapSheetSplitLayout(mode: MapSheetMode) {
  const [layoutHeight, setLayoutHeight] = useState(0);
  const [isSheetDragging, setIsSheetDragging] = useState(false);
  const dragOriginSheetHeightRef = useRef(VIEWPORT_PEEK_HEIGHT);
  const mapSlotHeight = useSharedValue(
    getMapSlotHeight(ESTIMATED_LAYOUT_HEIGHT, VIEWPORT_PEEK_HEIGHT)
  );

  const snapHeights = layoutHeight > 0 ? getSheetSnapHeights(layoutHeight, mode) : [];

  const applySheetHeight = useCallback(
    (sheetHeight: number, animated = false) => {
      if (layoutHeight <= 0) return;
      const clamped = clampSheetHeight(sheetHeight, layoutHeight, mode);
      const nextMap = getMapSlotHeight(layoutHeight, clamped);
      mapSlotHeight.value = animated
        ? withSpring(nextMap, SHEET_SPRING_CONFIG)
        : nextMap;
    },
    [layoutHeight, mode, mapSlotHeight]
  );

  const handleColumnLayout = useCallback(
    (height: number) => {
      if (height <= 0 || height === layoutHeight) return;
      setLayoutHeight(height);
      const initialSheet = getInitialSheetHeight(height, mode);
      mapSlotHeight.value = getMapSlotHeight(height, initialSheet);
    },
    [layoutHeight, mode, mapSlotHeight]
  );

  const setSheetSnapIndex = useCallback(
    (index: number, animated = true) => {
      if (layoutHeight <= 0) return;
      const targetSheet = getSheetSnapHeights(layoutHeight, mode)[index];
      if (targetSheet == null) return;
      applySheetHeight(targetSheet, animated);
    },
    [applySheetHeight, layoutHeight, mode]
  );

  const beginSheetDrag = useCallback(
    (snapIndex: number) => {
      if (layoutHeight <= 0) return;
      const heights = getSheetSnapHeights(layoutHeight, mode);
      const origin = heights[snapIndex] ?? heights[0] ?? VIEWPORT_PEEK_HEIGHT;
      dragOriginSheetHeightRef.current = origin;
      setIsSheetDragging(true);
    },
    [layoutHeight, mode]
  );

  const updateSheetDrag = useCallback(
    (dy: number) => {
      if (layoutHeight <= 0) return;
      const nextSheet = clampSheetHeight(
        dragOriginSheetHeightRef.current - dy,
        layoutHeight,
        mode
      );
      mapSlotHeight.value = getMapSlotHeight(layoutHeight, nextSheet);
    },
    [layoutHeight, mode, mapSlotHeight]
  );

  const finishSheetDrag = useCallback(
    (dy: number, velocityY: number) => {
      if (layoutHeight <= 0) return 0;
      setIsSheetDragging(false);
      const currentSheet = clampSheetHeight(
        dragOriginSheetHeightRef.current - dy,
        layoutHeight,
        mode
      );
      const targetIndex = resolveSheetSnapIndex(currentSheet, layoutHeight, mode, velocityY);
      const targetSheet = getSheetSnapHeights(layoutHeight, mode)[targetIndex] ?? currentSheet;
      applySheetHeight(targetSheet, true);
      return targetIndex;
    },
    [applySheetHeight, layoutHeight, mode]
  );

  return {
    layoutHeight,
    snapHeights,
    isSheetDragging,
    mapSlotHeight,
    handleColumnLayout,
    setSheetSnapIndex,
    beginSheetDrag,
    updateSheetDrag,
    finishSheetDrag,
  };
};
