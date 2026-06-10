import { useCallback, useState } from 'react';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import {
  getInitialSheetHeight,
  getMapSlotHeight,
  getScreenHeight,
  getSheetSnapHeights,
  MAP_CAMERA_ANIMATION_MS,
  type MapSheetMode,
  VIEWPORT_PEEK_HEIGHT,
} from '@/utils/map-sheet-layout';

const ESTIMATED_LAYOUT_HEIGHT = getScreenHeight();

export function useMapSheetSplitLayout(mode: MapSheetMode) {
  const [layoutHeight, setLayoutHeight] = useState(0);
  const mapSlotHeight = useSharedValue(
    getMapSlotHeight(ESTIMATED_LAYOUT_HEIGHT, VIEWPORT_PEEK_HEIGHT)
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
      if (!targetSheet) return;
      const nextMap = getMapSlotHeight(layoutHeight, targetSheet);
      mapSlotHeight.value = animated
        ? withTiming(nextMap, { duration: MAP_CAMERA_ANIMATION_MS })
        : nextMap;
    },
    [layoutHeight, mode, mapSlotHeight]
  );

  return {
    layoutHeight,
    mapSlotHeight,
    handleColumnLayout,
    setSheetSnapIndex,
  };
}
