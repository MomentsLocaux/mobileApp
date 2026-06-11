import { useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import type { MapWrapperHandle } from '@/components/map';
import { MAP_CAMERA_ANIMATION_MS, SHEET_LAYOUT_TIMING } from '@/utils/map-sheet-layout';
import { getBoundsFromRadiusKm } from '@/utils/search-helpers';
import { MAP_FIT_PADDING, MAP_FOCUS_PADDING_BOTTOM } from '@/constants/map-screen';
import type { EventWithCreator } from '@/types/database';
import type { MapBounds } from '@/types/map-events';
import type { useMapProgrammaticMove } from './useMapProgrammaticMove';
import type { ViewportFetchOptions } from './useViewportEventsFetch';

type ProgrammaticMove = ReturnType<typeof useMapProgrammaticMove>;

type Params = {
  mapRef: RefObject<MapWrapperHandle | null>;
  isSheetDraggingRef: RefObject<boolean>;
  viewportFrozenRef: RefObject<boolean>;
  frozenViewportBoundsRef: RefObject<MapBounds | null>;
  programmatic: ProgrammaticMove;
  queueViewportFetch: (bounds: MapBounds, options?: ViewportFetchOptions) => void;
  clearFrozenViewport: () => void;
  freezeViewportResults: () => void;
  zoomRef: RefObject<number>;
  onUnlockViewport?: () => void;
};

export function useMapViewportController({
  mapRef,
  isSheetDraggingRef,
  viewportFrozenRef,
  frozenViewportBoundsRef,
  programmatic,
  queueViewportFetch,
  clearFrozenViewport,
  freezeViewportResults,
  zoomRef,
  onUnlockViewport,
}: Params) {
  const initialViewportLoadInFlightRef = useRef(false);
  const {
    isProgrammaticMoveRef,
    pendingProgrammaticRefreshRef,
    suppressBoundsRecalc,
    isBoundsRecalcSuppressed,
    clearProgrammaticMoveState,
    withProgrammaticMove,
    startProgrammaticMove,
  } = programmatic;

  const handleUserMapGestureStart = useCallback(() => {
    clearProgrammaticMoveState();
    programmatic.suppressBoundsRecalcUntilRef.current = 0;
  }, [clearProgrammaticMoveState, programmatic.suppressBoundsRecalcUntilRef]);

  const unlockViewportFromUserPan = useCallback(
    (bounds: MapBounds) => {
      viewportFrozenRef.current = false;
      clearFrozenViewport();
      onUnlockViewport?.();
      frozenViewportBoundsRef.current = bounds;
      queueViewportFetch(bounds, { immediate: true, force: true });
    },
    [clearFrozenViewport, onUnlockViewport, queueViewportFetch]
  );

  const handleBoundsChange = useCallback(
    (
      bounds: MapBounds,
      meta?: { isUserInteraction?: boolean }
    ) => {
      const isUserInteraction = meta?.isUserInteraction === true;

      if (isUserInteraction) {
        clearProgrammaticMoveState();
        programmatic.suppressBoundsRecalcUntilRef.current = 0;
        if (viewportFrozenRef.current) {
          unlockViewportFromUserPan(bounds);
          return;
        }
        frozenViewportBoundsRef.current = bounds;
        queueViewportFetch(bounds, { immediate: true, force: true });
        return;
      }

      if (isProgrammaticMoveRef.current) {
        isProgrammaticMoveRef.current = false;
        mapRef.current?.clearBoundsCache?.();
        if (pendingProgrammaticRefreshRef.current) {
          pendingProgrammaticRefreshRef.current = false;
          queueViewportFetch(bounds, { immediate: true, force: true });
        }
        return;
      }

      if (viewportFrozenRef.current) return;
      if (isSheetDraggingRef.current || isBoundsRecalcSuppressed()) return;

      frozenViewportBoundsRef.current = bounds;
      queueViewportFetch(bounds);
    },
    [
      clearProgrammaticMoveState,
      isBoundsRecalcSuppressed,
      isProgrammaticMoveRef,
      isSheetDraggingRef,
      mapRef,
      pendingProgrammaticRefreshRef,
      programmatic.suppressBoundsRecalcUntilRef,
      queueViewportFetch,
      unlockViewportFromUserPan,
      viewportFrozenRef,
    ]
  );

  const ensureInitialViewportLoad = useCallback(async () => {
    if (initialViewportLoadInFlightRef.current) return;
    initialViewportLoadInFlightRef.current = true;

    try {
      for (let attempt = 0; attempt < 16; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 500 : 350));
        isProgrammaticMoveRef.current = false;
        mapRef.current?.clearBoundsCache?.();
        const bounds = await mapRef.current?.getVisibleBounds?.();
        if (!bounds) continue;
        queueViewportFetch(bounds, { immediate: true, force: true });
        return;
      }
    } finally {
      initialViewportLoadInFlightRef.current = false;
    }
  }, [isProgrammaticMoveRef, mapRef, queueViewportFetch]);

  const refreshBounds = useCallback(async (options?: Pick<ViewportFetchOptions, 'metaFilter'>) => {
    const bounds = await mapRef.current?.getVisibleBounds?.();
    if (!bounds) return;

    viewportFrozenRef.current = false;
    clearFrozenViewport();
    isProgrammaticMoveRef.current = false;
    mapRef.current?.clearBoundsCache?.();
    frozenViewportBoundsRef.current = bounds;
    queueViewportFetch(bounds, { immediate: true, force: true, metaFilter: options?.metaFilter });
  }, [clearFrozenViewport, isProgrammaticMoveRef, mapRef, queueViewportFetch]);

  const refitMapToFrozenViewport = useCallback(
    (animationDuration = MAP_CAMERA_ANIMATION_MS) => {
      const bounds = frozenViewportBoundsRef.current;
      if (!bounds) return;

      withProgrammaticMove(
        () => {
          mapRef.current?.fitToBounds(bounds, MAP_FIT_PADDING, animationDuration);
        },
        { refreshAfter: false, durationMs: animationDuration }
      );
    },
    [mapRef, withProgrammaticMove]
  );

  const syncMapToFrozenViewport = useCallback(() => {
    if (!frozenViewportBoundsRef.current) return;
    refitMapToFrozenViewport(SHEET_LAYOUT_TIMING.duration);
  }, [refitMapToFrozenViewport]);

  const lockViewportForSheet = useCallback(async () => {
    viewportFrozenRef.current = true;
    freezeViewportResults();

    if (!frozenViewportBoundsRef.current) {
      const bounds = await mapRef.current?.getVisibleBounds?.();
      if (bounds) {
        frozenViewportBoundsRef.current = bounds;
      }
    }
  }, [freezeViewportResults, mapRef]);

  const fitToRadius = useCallback(
    (latitude: number, longitude: number, radiusKm: number) => {
      const bounds = getBoundsFromRadiusKm(latitude, longitude, radiusKm);
      const coords = [
        { latitude: bounds.sw[1], longitude: bounds.sw[0] },
        { latitude: bounds.ne[1], longitude: bounds.ne[0] },
      ];
      withProgrammaticMove(() => mapRef.current?.fitToCoordinates(coords, MAP_FIT_PADDING));
      return bounds;
    },
    [mapRef, withProgrammaticMove]
  );

  const focusOnEvent = useCallback(
    (event: EventWithCreator, options?: { bumpZoom?: boolean }) => {
      if (typeof event.longitude !== 'number' || typeof event.latitude !== 'number') return;

      const targetZoom =
        options?.bumpZoom === false ? zoomRef.current : Math.max(zoomRef.current, 14);

      withProgrammaticMove(
        () => {
          mapRef.current?.focusOnCoordinate({
            longitude: event.longitude,
            latitude: event.latitude,
            zoom: targetZoom,
            paddingBottom: MAP_FOCUS_PADDING_BOTTOM,
          });
        },
        { refreshAfter: false }
      );
    },
    [mapRef, withProgrammaticMove, zoomRef]
  );

  return {
    ...programmatic,
    handleUserMapGestureStart,
    handleBoundsChange,
    ensureInitialViewportLoad,
    refreshBounds,
    refitMapToFrozenViewport,
    syncMapToFrozenViewport,
    lockViewportForSheet,
    fitToRadius,
    focusOnEvent,
    unlockViewportFromUserPan,
  };
}
