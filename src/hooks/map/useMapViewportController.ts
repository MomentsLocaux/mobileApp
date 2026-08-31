import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { MapWrapperHandle } from '@/components/map';
import { useMapResultsUIStore } from '@/store';
import { MAP_CAMERA_ANIMATION_MS, SHEET_LAYOUT_TIMING } from '@/utils/map-sheet-layout';
import { traceMapSheetPerf } from '@/utils/map-sheet-perf-trace';
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
  /** True after the first real viewport fetch was queued — avoids focus+ready+recenter triple load. */
  const viewportBootstrappedRef = useRef(false);
  const bootstrapLoadingGuardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    isProgrammaticMoveRef,
    pendingProgrammaticRefreshRef,
    isBoundsRecalcSuppressed,
    clearProgrammaticMoveState,
    withProgrammaticMove,
  } = programmatic;

  const clearBootstrapLoadingGuardTimer = useCallback(() => {
    if (bootstrapLoadingGuardTimerRef.current) {
      clearTimeout(bootstrapLoadingGuardTimerRef.current);
      bootstrapLoadingGuardTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearBootstrapLoadingGuardTimer(), [clearBootstrapLoadingGuardTimer]);

  const markViewportBootstrapped = useCallback(() => {
    viewportBootstrappedRef.current = true;
  }, []);

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
    [clearFrozenViewport, frozenViewportBoundsRef, onUnlockViewport, queueViewportFetch, viewportFrozenRef]
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
          markViewportBootstrapped();
          return;
        }
        frozenViewportBoundsRef.current = bounds;
        markViewportBootstrapped();
        queueViewportFetch(bounds, { immediate: true, force: true });
        return;
      }

      if (isProgrammaticMoveRef.current) {
        isProgrammaticMoveRef.current = false;
        mapRef.current?.clearBoundsCache?.();
        if (pendingProgrammaticRefreshRef.current) {
          pendingProgrammaticRefreshRef.current = false;
          markViewportBootstrapped();
          queueViewportFetch(bounds, { immediate: true, force: true });
        }
        return;
      }

      if (viewportFrozenRef.current) return;
      if (isSheetDraggingRef.current || isBoundsRecalcSuppressed()) return;

      frozenViewportBoundsRef.current = bounds;
      markViewportBootstrapped();
      queueViewportFetch(bounds);
    },
    [
      clearProgrammaticMoveState,
      frozenViewportBoundsRef,
      isBoundsRecalcSuppressed,
      isProgrammaticMoveRef,
      isSheetDraggingRef,
      mapRef,
      markViewportBootstrapped,
      pendingProgrammaticRefreshRef,
      programmatic.suppressBoundsRecalcUntilRef,
      queueViewportFetch,
      unlockViewportFromUserPan,
      viewportFrozenRef,
    ]
  );

  const ensureInitialViewportLoad = useCallback(async () => {
    traceMapSheetPerf('ensureInitialViewportLoad');
    if (viewportBootstrappedRef.current) return;
    if (initialViewportLoadInFlightRef.current) return;
    initialViewportLoadInFlightRef.current = true;
    useMapResultsUIStore.getState().setStatus('loading');

    try {
      for (let attempt = 0; attempt < 16; attempt += 1) {
        if (viewportBootstrappedRef.current) return;
        await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 500 : 350));
        if (viewportBootstrappedRef.current) return;
        isProgrammaticMoveRef.current = false;
        mapRef.current?.clearBoundsCache?.();
        const bounds = await mapRef.current?.getVisibleBounds?.();
        if (!bounds) continue;
        markViewportBootstrapped();
        queueViewportFetch(bounds, { immediate: true, force: true });
        return;
      }
      useMapResultsUIStore.getState().setStatus('browsing');
      useMapResultsUIStore
        .getState()
        .setViewportFetchError('Impossible de lire la zone visible de la carte.');
    } finally {
      initialViewportLoadInFlightRef.current = false;
      // Another path marked bootstrapped while we waited — don't leave loading forever
      // if that path never finished publishing results.
      if (
        viewportBootstrappedRef.current &&
        useMapResultsUIStore.getState().sheetStatus === 'loading'
      ) {
        // Give the in-flight force fetch a moment; clear only if still stuck shortly after.
        clearBootstrapLoadingGuardTimer();
        bootstrapLoadingGuardTimerRef.current = setTimeout(() => {
          bootstrapLoadingGuardTimerRef.current = null;
          if (useMapResultsUIStore.getState().sheetStatus === 'loading') {
            useMapResultsUIStore.getState().setStatus('browsing');
            // Don't leave a stale banner if markers/list already recovered via another path.
            if (useMapResultsUIStore.getState().sheetEvents.length > 0) {
              useMapResultsUIStore.getState().setViewportFetchError(null);
            }
          }
        }, 4000);
      }
    }
  }, [clearBootstrapLoadingGuardTimer, isProgrammaticMoveRef, mapRef, markViewportBootstrapped, queueViewportFetch]);

  const refreshBounds = useCallback(async (options?: Pick<ViewportFetchOptions, 'metaFilter'>) => {
    traceMapSheetPerf('refreshBounds');
    const bounds = await mapRef.current?.getVisibleBounds?.();
    if (!bounds) return;

    viewportFrozenRef.current = false;
    clearFrozenViewport();
    isProgrammaticMoveRef.current = false;
    mapRef.current?.clearBoundsCache?.();
    frozenViewportBoundsRef.current = bounds;
    markViewportBootstrapped();
    queueViewportFetch(bounds, { immediate: true, force: true, metaFilter: options?.metaFilter });
  }, [clearFrozenViewport, frozenViewportBoundsRef, isProgrammaticMoveRef, mapRef, markViewportBootstrapped, queueViewportFetch, viewportFrozenRef]);

  const refitMapToFrozenViewport = useCallback(
    (
      animationDuration = MAP_CAMERA_ANIMATION_MS,
      options?: { paddingBottom?: number }
    ) => {
      const bounds = frozenViewportBoundsRef.current;
      if (!bounds) return;
      const paddingBottom =
        typeof options?.paddingBottom === 'number'
          ? Math.max(MAP_FIT_PADDING, Math.round(options.paddingBottom))
          : MAP_FIT_PADDING;
      const padding =
        paddingBottom === MAP_FIT_PADDING
          ? MAP_FIT_PADDING
          : [MAP_FIT_PADDING, MAP_FIT_PADDING, paddingBottom, MAP_FIT_PADDING];

      withProgrammaticMove(
        () => {
          mapRef.current?.fitToBounds(bounds, padding, animationDuration);
        },
        { refreshAfter: false, durationMs: animationDuration }
      );
    },
    [frozenViewportBoundsRef, mapRef, withProgrammaticMove]
  );

  const syncMapToFrozenViewport = useCallback((options?: {
    paddingBottom?: number;
    animationDuration?: number;
  }) => {
    traceMapSheetPerf('syncMapToFrozenViewport');
    if (!frozenViewportBoundsRef.current) return;
    refitMapToFrozenViewport(options?.animationDuration ?? SHEET_LAYOUT_TIMING.duration, options);
  }, [frozenViewportBoundsRef, refitMapToFrozenViewport]);

  const lockViewportForSheet = useCallback(async () => {
    viewportFrozenRef.current = true;
    freezeViewportResults();

    if (!frozenViewportBoundsRef.current) {
      const bounds = await mapRef.current?.getVisibleBounds?.();
      if (bounds) {
        frozenViewportBoundsRef.current = bounds;
      }
    }
  }, [freezeViewportResults, frozenViewportBoundsRef, mapRef, viewportFrozenRef]);

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
    viewportBootstrappedRef,
  };
}
