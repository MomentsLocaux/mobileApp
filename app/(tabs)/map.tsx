import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, TouchableOpacity, Linking, InteractionManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  SHEET_JUNCTION_RADIUS,
  SHEET_LAYOUT_TIMING,
  VIEWPORT_PEEK_HEIGHT,
  VIEWPORT_FULL_SNAP_INDEX,
  VIEWPORT_HALF_SNAP_INDEX,
  getSheetMaxSnapIndex,
  getSheetSnapHeights,
  MAP_CAMERA_ANIMATION_MS,
  resolveEffectiveSheetSnapIndex,
  resolveMapTabBarProgress,
  sheetSnapIndexWhenOpeningRefine,
  shouldFollowMapCameraForSheetIndex,
} from '../../src/utils/map-sheet-layout';
import { traceMapSheetPerf } from '@/utils/map-sheet-perf-trace';
import {
  cloneMapBounds,
  cloneSheetCameraSnapshot,
  getSheetCameraPaddingBottom,
  resolveSheetCameraFitBounds,
  shouldCaptureSheetCameraAnchor,
  shouldRestoreSheetCameraAnchor,
} from '@/utils/map-sheet-camera';
import type { MapBounds } from '@/types/map-events';
import { useMapSheetSplitLayout } from '@/hooks/useMapSheetSplitLayout';
import {
  useMapScreenData,
  useMapSheetOrchestration,
  useMapSearchApply,
  useMapSocialActions,
  useMapMarkerPress,
  useMapDeepLinkFocus,
  useMapLocationBootstrap,
  useMapFilterActions,
} from '@/hooks/map';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Layers, Navigation, SlidersHorizontal, ZoomIn } from 'lucide-react-native';
import Mapbox from '@rnmapbox/maps';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MapWrapper,
  type MapCameraSnapshot,
  type MapWrapperHandle,
} from '../../src/components/map';
import { useAuth, useLocation } from '@/hooks';
import {
  useDiscoveryFiltersStore,
  useLocationStore,
  useMapResultsUIStore,
  useMapTransferStore,
} from '../../src/store';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useLikesStore } from '@/store/likesStore';
import { colors, spacing, borderRadius } from '../../src/constants/theme';
import {
  FRANCE_CAMERA_BOUNDS,
  MAP_FIT_PADDING,
  MAP_VIEW_PADDING,
  SIM_FALLBACK_COORDS,
} from '@/constants/map-screen';
import { DISCOVERY_DEFAULT_RADIUS_KM } from '@/constants/filters';
import { SearchBar } from '../../src/components/search/SearchBar';
import { MapViewportRefinePanel } from '../../src/components/search/MapViewportRefinePanel';
import { hasSearchCriteria as checkSearchCriteria } from '../../src/utils/search-helpers';
import {
  SearchResultsBottomSheet,
  type SearchResultsBottomSheetHandle,
} from '../../src/components/search/SearchResultsBottomSheet';
import { MapEventUnitOverlay } from '../../src/components/search/MapEventUnitOverlay';
import { FloatingPressable } from '../../src/components/ui/FloatingPressable';
import { NavigationOptionsSheet } from '../../src/components/search/NavigationOptionsSheet';
import type { EventWithCreator } from '../../src/types/database';
import { AppBackground, BrandLogoSpinner } from '../../src/components/ui';
import { useMapTabBarProgress } from '@/components/navigation/MapAwareTabBar';
import { haptics } from '@/utils/haptics';
import {
  includesPast,
  resolveSortCenter,
  toEventFilters,
  type DiscoveryFilters,
} from '@/utils/discovery-filters';
import {
  isMapBoundsTooLarge,
  MAP_BBOX_TIGHTEN_DIAMETER_KM,
  shrinkMapBoundsToMaxDiameter,
} from '@/utils/map-viewport-fetch-utils';
import { MAP_BBOX_TOO_LARGE_MESSAGE } from '@/utils/bbox-event-fetch';
import {
  collectDiscoveryHandoffEventIds,
  isDiscoverySearchActive,
  resolveHomeMapRadiusTarget,
  resolveMapClientFilters,
  resolveMapHandoffMode,
  shouldApplyPendingHomeRecadrage,
  shouldRefetchViewportOnTabFocus,
  shouldUseMapLastVisitCamera,
  resolveUnitCardCloseCameraAction,
} from '@/utils/map-discovery-contract';
import { resolveMapInitialCamera, shouldBootstrapViewportFetch } from '@/utils/map-camera-fallback';
import { filterEvents } from '@/utils/filter-events';
import { sortEvents } from '@/utils/sort-events';
import { buildMapMarkerCollection } from '@/utils/map-marker-features';
import { isDefaultDiscoveryTemporal } from '@/utils/search-temporal-choice';
import { useMapDetailTransitionStore } from '@/store/mapDetailTransitionStore';
import { useEventPreviewStore } from '@/store/eventPreviewStore';
import {
  isMapSnapshotStale,
  useDiscoverySnapshotStore,
} from '@/store/discoverySnapshotStore';
import { prefetchEventMedia } from '@/utils/prefetch-event-media';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { MAP_PREVIEW_CARD_ESTIMATED_HEIGHT } from '@/constants/event-card-variants';
import { Motion } from '@/constants/motion';
import {
  UNIT_CARD_CYCLE_SHEET_END,
  unitCycleSheetReveal,
} from '@/utils/map-unit-cycle';

const MAP_BOOTSTRAP_REVEAL_MAX_MS = 1800;

export default function MapScreen() {
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const { requestPermission: requestLocationPermission } = useLocation();
  const reduceMotion = useReduceMotion();

  const currentLocation = useLocationStore((s) => s.currentLocation);
  const locationLoading = useLocationStore((s) => s.isLoading);
  const permissionGranted = useLocationStore((s) => s.permissionGranted);
  const locationError = useLocationStore((s) => s.error);
  const discoveryStatus = useDiscoveryFiltersStore((s) => s.status);
  const when = useDiscoveryFiltersStore((s) => s.when);
  const place = useDiscoveryFiltersStore((s) => s.place);
  const content = useDiscoveryFiltersStore((s) => s.content);
  const sort = useDiscoveryFiltersStore((s) => s.sort);
  const mapMode = useDiscoveryFiltersStore((s) => s.mapMode);
  const searchApplied = useDiscoveryFiltersStore((s) => s.searchApplied);
  const setSort = useDiscoveryFiltersStore((s) => s.setSort);
  const setMapMode = useDiscoveryFiltersStore((s) => s.setMapMode);
  const setSearchApplied = useDiscoveryFiltersStore((s) => s.setSearchApplied);
  const setPlace = useDiscoveryFiltersStore((s) => s.setPlace);
  const { profile } = useAuth();
  const favorites = useFavoritesStore((s) => s.favorites);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const likedEventIds = useLikesStore((s) => s.likedEventIds);
  const toggleLike = useLikesStore((s) => s.toggleLike);
  const bottomSheetIndex = useMapResultsUIStore((s) => s.bottomSheetIndex);
  const setBottomSheetIndex = useMapResultsUIStore((s) => s.setBottomSheetIndex);
  const sheetStatus = useMapResultsUIStore((s) => s.sheetStatus);
  const sheetEvents = useMapResultsUIStore((s) => s.sheetEvents);
  const visibleEventCount = useMapResultsUIStore((s) => s.visibleEventCount);
  const activeEventId = useMapResultsUIStore((s) => s.activeEventId);
  const viewportFetchError = useMapResultsUIStore((s) => s.viewportFetchError);
  const viewportAreaWarning = useMapResultsUIStore((s) => s.viewportAreaWarning);
  const setStatus = useMapResultsUIStore((s) => s.setStatus);
  const setViewportFetchError = useMapResultsUIStore((s) => s.setViewportFetchError);
  const setViewportAreaWarning = useMapResultsUIStore((s) => s.setViewportAreaWarning);
  const highlightViewportEvent = useMapResultsUIStore((s) => s.highlightViewportEvent);
  const selectSingleEvent = useMapResultsUIStore((s) => s.selectSingleEvent);
  const freezeViewportResults = useMapResultsUIStore((s) => s.freezeViewportResults);
  const clearFrozenViewport = useMapResultsUIStore((s) => s.clearFrozenViewport);
  const closeSheet = useMapResultsUIStore((s) => s.closeSheet);
  const restoreViewportFromFrozen = useMapResultsUIStore((s) => s.restoreViewportFromFrozen);
  const homeTransfer = useMapTransferStore((s) => s.homeTransfer);
  const clearHomeTransfer = useMapTransferStore((s) => s.clearHomeTransfer);

  const insets = useSafeAreaInsets();
  const sheetMode = sheetStatus === 'singleEvent' ? 'single' : 'viewport';
  const {
    minSheetHeightShared,
    maxSheetHeightShared,
    layoutHeightShared,
    sheetVisibleHeight,
    sheetProgress,
    isSheetDraggingRef: sheetDraggingRef,
    handleColumnLayout,
    setSheetSnapIndex,
    beginSheetDrag,
  } = useMapSheetSplitLayout(sheetMode, bottomSheetIndex);
  const tabBarProgress = useMapTabBarProgress();

  const mapRef = useRef<MapWrapperHandle>(null);
  const resultsSheetRef = useRef<SearchResultsBottomSheetHandle>(null);
  const isSheetDraggingRef = useRef(false);
  const [isSheetDragging, setIsSheetDragging] = useState(false);
  const latestVisibleBoundsRef = useRef<MapBounds | null>(null);
  const singleEventFocusIdRef = useRef<string | null>(null);
  const markerSelectionGuardRef = useRef(false);
  const unitCameraSnapshotRef = useRef<MapCameraSnapshot | null>(null);
  const sheetCameraSnapshotRef = useRef<MapCameraSnapshot | null>(null);
  const sheetCameraBoundsRef = useRef<MapBounds | null>(null);
  const restoreCameraOnUnitExitRef = useRef(true);
  const unitCardOpenedViaFocusRef = useRef(false);
  const dismissUnitCardRef = useRef<(restoreCamera?: boolean) => void>(() => {});
  const unitCycleGenerationRef = useRef(0);
  const zoomRef = useRef(12);
  const mapReadyRef = useRef(false);
  const appliedHomeTransferIdRef = useRef<string | null>(null);
  const focusedSearchRevisionRef = useRef<number | null>(null);
  const sheetSnapBeforeRefineRef = useRef<number | null>(null);
  const sheetSnapBeforeDetailRef = useRef<number | null>(null);

  const [navEvent, setNavEvent] = useState<EventWithCreator | null>(null);
  const [unitCardEvent, setUnitCardEvent] = useState<EventWithCreator | null>(null);
  const pendingSheetSideEffectsIndexRef = useRef<number | null>(null);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);
  const [mapColumnHeight, setMapColumnHeight] = useState(0);
  const [pendingSearchAreaBounds, setPendingSearchAreaBounds] = useState<MapBounds | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const mapSnapshot = useDiscoverySnapshotStore((state) => state.map);
  const discoveryHydrated = useDiscoverySnapshotStore((state) => state.hydrated);
  const cacheEpoch = useEventPreviewStore((state) => state.epoch);
  const hasMapSnapshot = Boolean(
    mapSnapshot?.camera || (mapSnapshot?.markerEventIds.length ?? 0) > 0,
  );
  const [initialMapPresentationReady, setInitialMapPresentationReady] = useState(hasMapSnapshot);
  const unitCardModeProgress = useSharedValue(0);
  const returningEventId = useMapDetailTransitionStore((state) => state.returningEventId);

  const handleZoomChange = useCallback((nextZoom: number) => {
    zoomRef.current = nextZoom;
  }, []);

  useEffect(() => {
    isSheetDraggingRef.current = isSheetDragging;
    sheetDraggingRef.current = isSheetDragging;
  }, [isSheetDragging, sheetDraggingRef]);

  useAnimatedReaction(
    () => resolveMapTabBarProgress(sheetProgress.value),
    (progress) => {
      tabBarProgress.value = progress;
    },
    [tabBarProgress],
  );

  const userLocation = useMemo(() => {
    if (!currentLocation) return null;
    const { latitude, longitude } = currentLocation.coords;
    const isSimulatorDefault =
      Math.abs(latitude - SIM_FALLBACK_COORDS.latitude) < 1e-6 &&
      Math.abs(longitude - SIM_FALLBACK_COORDS.longitude) < 1e-6;
    if (isSimulatorDefault) return null;
    return { latitude, longitude };
  }, [currentLocation]);

  const hasSearchCriteria = useMemo(
    () => checkSearchCriteria({ place, when, content }),
    [content, place, when]
  );
  const searchActive = isDiscoverySearchActive(searchApplied, hasSearchCriteria);
  const useLastVisitCamera = shouldUseMapLastVisitCamera({
    searchActive,
    hasPendingHomeTransfer: Boolean(homeTransfer),
  });

  const mapCamera = useMemo(
    () =>
      resolveMapInitialCamera({
        userLocation,
        placeCenter: place.center ?? null,
        snapshotCamera: useLastVisitCamera ? mapSnapshot?.camera ?? null : null,
        liveIntent: searchActive ? 'search' : 'browse',
      }),
    [mapSnapshot?.camera, place.center, searchActive, useLastVisitCamera, userLocation]
  );
  const mapCenter = useMemo(
    () => ({
      latitude: mapCamera.latitude,
      longitude: mapCamera.longitude,
      zoom: mapCamera.zoom,
    }),
    [mapCamera.latitude, mapCamera.longitude, mapCamera.zoom],
  );

  const discoveryFilters = useMemo<DiscoveryFilters>(
    () => ({
      status: discoveryStatus,
      when,
      place,
      content,
      sort,
      mapMode,
    }),
    [content, discoveryStatus, mapMode, place, sort, when]
  );
  const metaFilter = discoveryStatus;
  const includePast = includesPast(discoveryFilters);
  const searchFilters = useMemo(
    () => toEventFilters(discoveryFilters, userLocation),
    [discoveryFilters, userLocation]
  );
  const sortBy = sort.map.sortBy;
  const sortOrder = sort.map.sortOrder;
  const sortCenter = useMemo(
    () => resolveSortCenter(discoveryFilters, userLocation),
    [discoveryFilters, userLocation]
  );
  const handlePendingSearchAreaChange = useCallback(
    (bounds: MapBounds | null) => {
      setPendingSearchAreaBounds(bounds);
      if (bounds) {
        setViewportFetchError(null);
        setViewportAreaWarning(
          isMapBoundsTooLarge(bounds) ? MAP_BBOX_TOO_LARGE_MESSAGE : null
        );
      }
    },
    [setViewportAreaWarning, setViewportFetchError]
  );

  const { fetch, viewport, viewportFrozenRef, frozenViewportBoundsRef } = useMapScreenData({
    mapRef,
    isSheetDraggingRef,
    zoomRef,
    clearFrozenViewport,
    freezeViewportResults,
    onUnlockViewport: () => dismissUnitCardRef.current(false),
    metaFilter,
    searchApplied,
    hasSearchCriteria,
    includePast,
    searchFilters,
    sortBy,
    sortOrder,
    sortCenter,
    searchActive,
    onPendingSearchAreaChange: handlePendingSearchAreaChange,
  });

  const {
    cancelViewportFetch,
    cancelAllMapRequests,
    nextMarkerRequestId,
    isMarkerRequestCurrent,
    reapplyClientFilters,
  } = fetch;

  const {
    suppressBoundsRecalc,
    handleUserMapGestureStart,
    handleBoundsChange,
    ensureInitialViewportLoad,
    refreshBounds,
    lockViewportForSheet,
    unlockViewportForSheet,
    fitToRadius,
    fitToBounds,
    focusOnEvent,
    viewportBootstrappedRef,
  } = viewport;

  useEffect(() => {
    if (initialMapPresentationReady) return;
    if (!mapReady || !discoveryHydrated) return;
    if (hasMapSnapshot) {
      setInitialMapPresentationReady(true);
      return;
    }
    const initialViewportSettled =
      viewportBootstrappedRef.current &&
      sheetStatus !== 'loading';
    if (!initialViewportSettled && !viewportFetchError) return;

    const revealTimer = setTimeout(() => {
      setInitialMapPresentationReady(true);
    }, 120);
    return () => clearTimeout(revealTimer);
  }, [
    discoveryHydrated,
    hasMapSnapshot,
    initialMapPresentationReady,
    mapReady,
    sheetStatus,
    viewportBootstrappedRef,
    viewportFetchError,
  ]);

  useEffect(() => {
    if (initialMapPresentationReady || !mapReady || !discoveryHydrated || hasMapSnapshot) return;
    const revealTimer = setTimeout(() => {
      setInitialMapPresentationReady(true);
    }, MAP_BOOTSTRAP_REVEAL_MAX_MS);
    return () => clearTimeout(revealTimer);
  }, [discoveryHydrated, hasMapSnapshot, initialMapPresentationReady, mapReady]);

  useEffect(() => {
    if (hasMapSnapshot) {
      setInitialMapPresentationReady(true);
    }
  }, [hasMapSnapshot]);

  useEffect(() => {
    if (!useLastVisitCamera) return;
    if (!mapSnapshot) return;
    const markerEvents = useEventPreviewStore.getState().getCachedEvents(mapSnapshot.markerEventIds);
    const sheet = useEventPreviewStore.getState().getCachedEvents(mapSnapshot.sheetEventIds);
    if (sheet.length && useMapResultsUIStore.getState().sheetEvents.length === 0) {
      useMapResultsUIStore.getState().displayViewportResults(sheet, {
        totalCount: markerEvents.length || sheet.length,
      });
    }
  }, [cacheEpoch, mapSnapshot, useLastVisitCamera]);

  const snapshotShapeAppliedRef = useRef(false);
  const snapshotCameraRestoredRef = useRef(false);
  useEffect(() => {
    if (!mapReady || !mapSnapshot) return;
    if (!useLastVisitCamera) {
      snapshotCameraRestoredRef.current = true;
      return;
    }
    if (!snapshotCameraRestoredRef.current && mapSnapshot.camera) {
      mapRef.current?.restoreCameraSnapshot(
        {
          latitude: mapSnapshot.camera.latitude,
          longitude: mapSnapshot.camera.longitude,
          zoom: mapSnapshot.camera.zoom,
        },
        { animationDuration: 0 },
      );
      snapshotCameraRestoredRef.current = true;
    }
    if (snapshotShapeAppliedRef.current) return;
    const markerEvents = useEventPreviewStore.getState().getCachedEvents(mapSnapshot.markerEventIds);
    if (!markerEvents.length) return;
    mapRef.current?.setShape(buildMapMarkerCollection(markerEvents));
    snapshotShapeAppliedRef.current = true;
  }, [cacheEpoch, mapReady, mapSnapshot, useLastVisitCamera]);

  const { handleCategoriesChange, handleTemporalChoice, handleCustomDateChange, handleClearViewportFilters } =
    useMapFilterActions({
    userLocation,
    discoveryStatus,
    reapplyClientFilters,
    cancelViewportFetch,
    refreshBounds,
    clearFrozenViewport,
  });

  const { applySearch } = useMapSearchApply({
    filters: discoveryFilters,
    userLocation,
    syncSearchState: (committedFilters) => {
      const committedSearchFilters = toEventFilters(committedFilters, userLocation);
      const committedHasSearchCriteria = checkSearchCriteria({
        place: committedFilters.place,
        when: committedFilters.when,
        content: committedFilters.content,
      });
      reapplyClientFilters({
        metaFilter: committedFilters.status,
        searchFilters: committedSearchFilters,
        searchApplied: committedHasSearchCriteria,
        hasSearchCriteria: committedHasSearchCriteria,
        includePast: includesPast(committedFilters),
      });
    },
    setStatus,
    fitToRadius,
    refreshBounds,
  });

  const { applySheetSideEffects } = useMapSheetOrchestration({
    resultsSheetRef,
    activeEventId,
    sheetStatus,
    sheetEvents,
    closeSheet,
    lockViewportForSheet,
    unlockViewportForSheet: () => {
      if (markerSelectionGuardRef.current) return;
      unlockViewportForSheet();
    },
    focusOnEvent,
    setUnitCardEvent,
  });

  const favoritesSet = useMemo(() => new Set(favorites.map((f) => f.id)), [favorites]);
  const likesSet = useMemo(() => new Set(likedEventIds), [likedEventIds]);

  const { handleToggleHeart } = useMapSocialActions({
    profileId: profile?.id,
    likesSet,
    favoritesSet,
    toggleLike,
    toggleFavorite,
  });

  const applySheetSideEffectsAfterSnap = useCallback(
    (targetIdx: number) => {
      traceMapSheetPerf('applySheetSideEffects', { targetIdx });
      if (shouldRestoreSheetCameraAnchor(targetIdx)) {
        applySheetSideEffects(targetIdx);
        traceMapSheetPerf('restoreCameraSnapshot', {
          reason: 'sheetClosing',
        });
        const snapshot = sheetCameraSnapshotRef.current;
        sheetCameraSnapshotRef.current = null;
        sheetCameraBoundsRef.current = null;
        if (snapshot) {
          mapRef.current?.restoreCameraSnapshot(
            snapshot,
            { animationDuration: 0 },
          );
        } else {
          mapRef.current?.resetCameraPadding();
        }
        return;
      }

      const hasAnchor = Boolean(sheetCameraSnapshotRef.current);
      if (shouldCaptureSheetCameraAnchor(targetIdx, hasAnchor)) {
        const snapshot = mapRef.current?.getCameraSnapshot() ?? null;
        const rawBounds = mapRef.current?.getCachedRawVisibleBounds() ?? null;
        if (snapshot) {
          sheetCameraSnapshotRef.current = cloneSheetCameraSnapshot(snapshot);
        }
        if (rawBounds) {
          sheetCameraBoundsRef.current = cloneMapBounds(rawBounds);
        }
      }

      applySheetSideEffects(targetIdx);

      if (!shouldFollowMapCameraForSheetIndex(targetIdx, sheetMode)) {
        return;
      }
      const fitBoundsTarget = resolveSheetCameraFitBounds(sheetCameraBoundsRef.current);
      if (!fitBoundsTarget) return;
      const visibleSheetHeight = sheetVisibleHeight.value;
      const paddingBottom = getSheetCameraPaddingBottom(
        visibleSheetHeight,
        layoutHeightShared.value,
        MAP_FIT_PADDING,
      );
      traceMapSheetPerf('fitSheetCameraAnchor', {
        reason: 'sheetSnapSettled',
        paddingBottom,
        visibleSheetHeight,
      });
      fitToBounds(fitBoundsTarget, {
        paddingBottom,
        animationDuration: SHEET_LAYOUT_TIMING.duration,
        refreshAfter: false,
      });
    },
    [
      applySheetSideEffects,
      fitToBounds,
      layoutHeightShared,
      sheetMode,
      sheetVisibleHeight,
    ]
  );

  const sheetOverlayStyle = useAnimatedStyle(() => {
    const maxHeight = maxSheetHeightShared.value;
    const visibleHeight = sheetVisibleHeight.value;
    const sheetReveal = unitCycleSheetReveal(unitCardModeProgress.value);
    const hiddenOffset = visibleHeight * (1 - sheetReveal);
    return {
      height: maxHeight,
      opacity: sheetReveal,
      transform: [
        {
          translateY: Math.max(0, maxHeight - visibleHeight) + hiddenOffset,
        },
      ],
    };
  });

  const handleBoundsChangeWithCache = useCallback(
    (bounds: MapBounds, meta?: { isUserInteraction?: boolean }) => {
      latestVisibleBoundsRef.current = bounds;
      traceMapSheetPerf('handleBoundsChange', meta);
      handleBoundsChange(bounds, meta);
    },
    [handleBoundsChange]
  );

  const handleHighlightEvent = useCallback(
    (event: EventWithCreator, options?: { focusMap?: boolean }) => {
      highlightViewportEvent(event);
      if (options?.focusMap === false) return;
      focusOnEvent(event, { bumpZoom: false });
    },
    [focusOnEvent, highlightViewportEvent]
  );

  const handleSheetDragStart = useCallback(
    (snapIndex: number) => {
      traceMapSheetPerf('handleSheetDragStart', { snapIndex });
      cancelViewportFetch();
      suppressBoundsRecalc(MAP_CAMERA_ANIMATION_MS + 800);
      beginSheetDrag(snapIndex);
      setIsSheetDragging(true);

      if (
        snapIndex !== 0 &&
        !frozenViewportBoundsRef.current &&
        latestVisibleBoundsRef.current
      ) {
        frozenViewportBoundsRef.current = latestVisibleBoundsRef.current;
      }
    },
    [
      beginSheetDrag,
      cancelViewportFetch,
      frozenViewportBoundsRef,
      suppressBoundsRecalc,
    ]
  );

  const handleSheetDragCancel = useCallback(() => {
    traceMapSheetPerf('handleSheetDragCancel', { snapIndex: bottomSheetIndex });
    pendingSheetSideEffectsIndexRef.current = null;
    setIsSheetDragging(false);
    setSheetSnapIndex(bottomSheetIndex, false);
  }, [bottomSheetIndex, setSheetSnapIndex]);

  const handleMapBackgroundPress = useCallback(() => {
    if (markerSelectionGuardRef.current) return;
    if (unitCardEvent) {
      dismissUnitCardRef.current(true);
      return;
    }
    setUnitCardEvent(null);
    useMapDetailTransitionStore.getState().clear();
    unlockViewportForSheet();
    closeSheet();
    resultsSheetRef.current?.collapseToPeek();
  }, [closeSheet, unitCardEvent, unlockViewportForSheet]);

  const handleSheetIndexChange = useCallback(
    (idx: number, options?: { animate?: boolean }) => {
      traceMapSheetPerf('handleSheetIndexChange', { idx });
      if (idx < 0) return;
      const clampedIdx = Math.min(idx, getSheetMaxSnapIndex(sheetMode));
      if (clampedIdx === bottomSheetIndex) return;

      cancelViewportFetch();
      suppressBoundsRecalc(SHEET_LAYOUT_TIMING.duration + 400);
      setBottomSheetIndex(clampedIdx);
      haptics.selection();

      if (options?.animate !== false) {
        setSheetSnapIndex(clampedIdx, true, () =>
          applySheetSideEffectsAfterSnap(clampedIdx)
        );
      } else {
        setSheetSnapIndex(clampedIdx, false, () =>
          applySheetSideEffectsAfterSnap(clampedIdx)
        );
      }
    },
    [
      applySheetSideEffectsAfterSnap,
      bottomSheetIndex,
      cancelViewportFetch,
      setBottomSheetIndex,
      setSheetSnapIndex,
      sheetMode,
      suppressBoundsRecalc,
    ]
  );

  const commitUnitSheetHidden = useCallback(() => {
    if (useMapResultsUIStore.getState().bottomSheetIndex !== 0) {
      setBottomSheetIndex(0);
      setSheetSnapIndex(0, false);
    }
    sheetCameraSnapshotRef.current = null;
    sheetCameraBoundsRef.current = null;
  }, [setBottomSheetIndex, setSheetSnapIndex]);

  useAnimatedReaction(
    () => unitCardModeProgress.value >= UNIT_CARD_CYCLE_SHEET_END,
    (hidden, wasHidden) => {
      if (hidden && wasHidden === false) {
        runOnJS(commitUnitSheetHidden)();
      }
    },
    [commitUnitSheetHidden],
  );

  const beginUnitCardPresentation = useCallback(
    (event: EventWithCreator | null) => {
      if (!event) return;
      unitCycleGenerationRef.current += 1;
      setUnitCardEvent(event);

      if (reduceMotion) {
        cancelAnimation(unitCardModeProgress);
        unitCardModeProgress.value = 1;
        commitUnitSheetHidden();
        return;
      }

      cancelAnimation(unitCardModeProgress);
      if (unitCardModeProgress.value >= 0.99) {
        unitCardModeProgress.value = 1;
        return;
      }
      unitCardModeProgress.value = withTiming(1, {
        duration: Motion.duration.normal,
        easing: Motion.easing.exit,
      });
    },
    [commitUnitSheetHidden, reduceMotion, unitCardModeProgress],
  );

  const finishUnitCardExit = useCallback((generation: number) => {
    if (generation !== unitCycleGenerationRef.current) return;
    setUnitCardEvent(null);
    useMapDetailTransitionStore.getState().clear();
    closeSheet();
    const cameraSnapshot = unitCameraSnapshotRef.current;
    unitCameraSnapshotRef.current = null;
    const cameraAction = resolveUnitCardCloseCameraAction({
      openedViaFocusHandoff: unitCardOpenedViaFocusRef.current,
      restoreRequested: restoreCameraOnUnitExitRef.current,
      hasSnapshot: Boolean(cameraSnapshot),
    });
    unitCardOpenedViaFocusRef.current = false;
    restoreCameraOnUnitExitRef.current = true;

    if (cameraAction === 'restore-snapshot' && cameraSnapshot) {
      mapRef.current?.restoreCameraSnapshot(cameraSnapshot);
    } else {
      mapRef.current?.resetCameraPadding();
    }
    unlockViewportForSheet();
    if (cameraAction === 'keep-and-refresh') {
      void refreshBounds();
    }
  }, [closeSheet, refreshBounds, unlockViewportForSheet]);

  const beginUnitCardDismissal = useCallback((restoreCamera = true) => {
    if (!unitCardEvent) return;
    restoreCameraOnUnitExitRef.current = restoreCamera;
    const generation = unitCycleGenerationRef.current + 1;
    unitCycleGenerationRef.current = generation;

    if (reduceMotion) {
      cancelAnimation(unitCardModeProgress);
      unitCardModeProgress.value = 0;
      finishUnitCardExit(generation);
      return;
    }

    cancelAnimation(unitCardModeProgress);
    unitCardModeProgress.value = withTiming(
      0,
      {
        duration: Motion.duration.fast,
        easing: Motion.easing.exit,
      },
      (finished) => {
        'worklet';
        if (finished) runOnJS(finishUnitCardExit)(generation);
      },
    );
  }, [finishUnitCardExit, reduceMotion, unitCardEvent, unitCardModeProgress]);

  dismissUnitCardRef.current = beginUnitCardDismissal;

  const { handleFeaturePress: handleMarkerFeaturePress } = useMapMarkerPress({
    mapRef,
    sheetEvents,
    viewportFrozenRef,
    frozenViewportBoundsRef,
    cancelAllMapRequests,
    nextMarkerRequestId,
    isMarkerRequestCurrent,
    highlightViewportEvent,
    freezeViewportResults,
    focusOnEvent,
    focusPaddingBottom:
      MAP_PREVIEW_CARD_ESTIMATED_HEIGHT + insets.bottom + spacing.xl,
    setUnitCardEvent: beginUnitCardPresentation,
    onMarkerLoadError: setViewportFetchError,
  });

  const handleFeaturePress = useCallback(
    (id: string) => {
      if (!unitCardEvent) {
        const snapshot = mapRef.current?.getCameraSnapshot() ?? null;
        unitCameraSnapshotRef.current = snapshot
          ? cloneSheetCameraSnapshot(snapshot)
          : null;
        restoreCameraOnUnitExitRef.current = true;
        unitCardOpenedViaFocusRef.current = false;
      }
      markerSelectionGuardRef.current = true;
      void handleMarkerFeaturePress(id).finally(() => {
        markerSelectionGuardRef.current = false;
      });
    },
    [handleMarkerFeaturePress, unitCardEvent]
  );

  const handleFocusHandoff = useCallback(
    (id: string) => {
      unitCameraSnapshotRef.current = null;
      restoreCameraOnUnitExitRef.current = false;
      unitCardOpenedViaFocusRef.current = true;
      markerSelectionGuardRef.current = true;
      void handleMarkerFeaturePress(id).finally(() => {
        markerSelectionGuardRef.current = false;
      });
    },
    [handleMarkerFeaturePress],
  );

  useMapDeepLinkFocus(focus, handleFocusHandoff);

  const handleSheetDragEnd = useCallback(
    (targetIdx: number) => {
      traceMapSheetPerf('handleSheetDragEnd', { targetIdx });
      setIsSheetDragging(false);

      if (targetIdx === bottomSheetIndex) {
        pendingSheetSideEffectsIndexRef.current = null;
        return;
      }

      pendingSheetSideEffectsIndexRef.current = targetIdx;
      cancelViewportFetch();
      suppressBoundsRecalc(SHEET_LAYOUT_TIMING.duration + 400);
      setBottomSheetIndex(targetIdx);
    },
    [
      bottomSheetIndex,
      cancelViewportFetch,
      setBottomSheetIndex,
      suppressBoundsRecalc,
    ]
  );

  const handleSheetSnapSettled = useCallback(
    (targetIdx: number) => {
      if (pendingSheetSideEffectsIndexRef.current !== targetIdx) return;
      pendingSheetSideEffectsIndexRef.current = null;
      applySheetSideEffectsAfterSnap(targetIdx);
    },
    [applySheetSideEffectsAfterSnap]
  );

  const refreshBoundsRef = useRef(refreshBounds);
  refreshBoundsRef.current = refreshBounds;
  const ensureInitialViewportLoadRef = useRef(ensureInitialViewportLoad);
  ensureInitialViewportLoadRef.current = ensureInitialViewportLoad;
  const restoreViewportFromFrozenRef = useRef(restoreViewportFromFrozen);
  restoreViewportFromFrozenRef.current = restoreViewportFromFrozen;
  const enterFocusedMapRef = useRef<() => void>(() => undefined);
  enterFocusedMapRef.current = () => {
    if (!mapReadyRef.current) return;

    const uiState = useMapResultsUIStore.getState();
    const savedDetailSnap = sheetSnapBeforeDetailRef.current;
    if (savedDetailSnap != null) {
      sheetSnapBeforeDetailRef.current = null;
      const returnMode =
        uiState.sheetStatus === 'singleEvent' ? 'single' : 'viewport';
      const restoredSnap = Math.min(
        savedDetailSnap,
        getSheetMaxSnapIndex(returnMode),
      );
      setBottomSheetIndex(restoredSnap);
      setSheetSnapIndex(restoredSnap, false);
      return;
    }

    if (uiState.sheetStatus === 'singleEvent' && uiState.frozenViewport) {
      restoreViewportFromFrozenRef.current({ keepHighlight: true });
    }

    const transferState = useMapTransferStore.getState();
    if (focus && transferState.homeTransfer) {
      transferState.clearHomeTransfer();
    }

    const latest = useDiscoveryFiltersStore.getState();
    const latestHasSearchCriteria = checkSearchCriteria({
      place: latest.place,
      when: latest.when,
      content: latest.content,
    });
    const searchActiveNow = isDiscoverySearchActive(
      latest.searchApplied,
      latestHasSearchCriteria
    );
    const transfer = focus ? null : transferState.homeTransfer;
    const shouldRecadrage = shouldApplyPendingHomeRecadrage({
      mapReady: true,
      transferId: transfer?.id,
      appliedTransferId: appliedHomeTransferIdRef.current,
      searchActive: searchActiveNow,
      searchRevision: latest.searchRevision,
      focusedSearchRevision: focusedSearchRevisionRef.current,
    });

    if (shouldRecadrage) {
      if (transfer) {
        appliedHomeTransferIdRef.current = transfer.id;
      }
      focusedSearchRevisionRef.current = latest.searchRevision;
      snapshotCameraRestoredRef.current = true;
      cancelAllMapRequests();
      viewportFrozenRef.current = false;
      clearFrozenViewport();
      setPendingSearchAreaBounds(null);
      setViewportAreaWarning(null);
      viewportBootstrappedRef.current = true;
      resultsSheetRef.current?.collapseToPeek();
      const cache = useEventPreviewStore.getState();
      const homeSnap = useDiscoverySnapshotStore.getState().home;
      const handoffIds = collectDiscoveryHandoffEventIds(
        searchActiveNow
          ? [
              cache.pinnedBySurface.home,
              cache.pinnedBySurface['home-view'],
              cache.pinnedBySurface['map-sheet'],
            ]
          : [
              cache.pinnedBySurface.home,
              cache.pinnedBySurface['map-sheet'],
              homeSnap?.eventIds,
            ]
      );
      const latestSearchFilters = toEventFilters(
        {
          status: latest.status,
          when: latest.when,
          place: latest.place,
          content: latest.content,
          sort: latest.sort,
          mapMode: latest.mapMode,
        },
        userLocation
      );
      const seeded = filterEvents(
        cache.getCachedEvents(handoffIds),
        resolveMapClientFilters(latestSearchFilters, searchActiveNow),
        null
      );
      if (seeded.length) {
        useMapResultsUIStore.getState().displayViewportResults(seeded, {
          totalCount: seeded.length,
        });
        mapRef.current?.setShape(buildMapMarkerCollection(seeded));
      } else {
        setStatus('loading');
      }
      const handoffMode = resolveMapHandoffMode({
        searchApplied: latest.searchApplied,
        hasSearchCriteria: latestHasSearchCriteria,
      });
      const target = resolveHomeMapRadiusTarget({
        searchActive: handoffMode === 'search',
        place: latest.place,
        userLocation,
      });
      InteractionManager.runAfterInteractions(() => {
        if (target) {
          frozenViewportBoundsRef.current = fitToRadius(
            target.latitude,
            target.longitude,
            target.radiusKm,
            { refreshAfter: true }
          );
        } else {
          void refreshBoundsRef.current();
        }
      });
      transferState.clearHomeTransfer();
      return;
    }

    if (searchActiveNow) {
      return;
    }

    resultsSheetRef.current?.collapseToPeek();
    const shouldLoad = shouldRefetchViewportOnTabFocus({
      bootstrapped: viewportBootstrappedRef.current,
      hasNewTransfer: false,
      hasNewSearchRevision: false,
    });
    if (!shouldLoad) return;
    if (userLocation || locationLoading) return;
    if (!shouldBootstrapViewportFetch(mapCamera.kind)) return;
    void ensureInitialViewportLoadRef.current();
  };

  useFocusEffect(
    useCallback(() => {
      enterFocusedMapRef.current();
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      if (!returningEventId) return;
      useMapDetailTransitionStore.getState().clear();
    }, [returningEventId]),
  );

  useEffect(() => {
    if (sheetStatus !== 'singleEvent' || !activeEventId || sheetEvents.length === 0) {
      if (sheetStatus !== 'singleEvent') {
        singleEventFocusIdRef.current = null;
      }
      return;
    }

    if (singleEventFocusIdRef.current === activeEventId) return;
    singleEventFocusIdRef.current = activeEventId;

    const targetIndex = 1;
    focusOnEvent(sheetEvents[0], { bumpZoom: true });
    resultsSheetRef.current?.open?.(targetIndex);
  }, [sheetStatus, activeEventId, sheetEvents, focusOnEvent]);

  const recenterToUser = useCallback(() => {
    if (!userLocation) return;
    clearHomeTransfer();
    appliedHomeTransferIdRef.current = null;
    setPendingSearchAreaBounds(null);
    if (searchApplied) {
      setSearchApplied(false);
    }
    fitToRadius(userLocation.latitude, userLocation.longitude, DISCOVERY_DEFAULT_RADIUS_KM, {
      refreshAfter: true,
    });
  }, [clearHomeTransfer, fitToRadius, searchApplied, setSearchApplied, userLocation]);

  useMapLocationBootstrap({
    userLocation,
    locationLoading,
    mapReady,
    recenterToUser,
    ensureInitialViewportLoad,
    disabled: searchActive,
    bootstrapViewportFetch: shouldBootstrapViewportFetch(mapCamera.kind),
    skipUserRecenter: hasMapSnapshot || !useLastVisitCamera,
  });

  const handleMapReady = useCallback(() => {
    mapReadyRef.current = true;
    setMapReady(true);
    enterFocusedMapRef.current();
  }, []);

  useEffect(() => {
    if (!hasSearchCriteria && isDefaultDiscoveryTemporal(discoveryStatus, when) && searchApplied) {
      setSearchApplied(false);
      void refreshBounds();
    }
  }, [discoveryStatus, hasSearchCriteria, searchApplied, refreshBounds, setSearchApplied, when]);

  const sortReapplyReadyRef = useRef(false);
  useEffect(() => {
    if (!sortReapplyReadyRef.current) {
      sortReapplyReadyRef.current = true;
      return;
    }
    reapplyClientFilters();
  }, [reapplyClientFilters, sortBy, sortOrder, sortCenter?.latitude, sortCenter?.longitude]);

  useEffect(() => {
    if (!searchActive) {
      setPendingSearchAreaBounds(null);
    }
  }, [searchActive]);

  const pendingSearchAreaTooLarge = useMemo(
    () => !!pendingSearchAreaBounds && isMapBoundsTooLarge(pendingSearchAreaBounds),
    [pendingSearchAreaBounds]
  );

  const handleApplyMapSearch = useCallback(
    (filters: DiscoveryFilters) => {
      clearHomeTransfer();
      appliedHomeTransferIdRef.current = null;
      setPendingSearchAreaBounds(null);
      setViewportAreaWarning(null);
      focusedSearchRevisionRef.current = useDiscoveryFiltersStore.getState().searchRevision;
      applySearch(filters);
    },
    [applySearch, clearHomeTransfer, setViewportAreaWarning]
  );

  const handleSearchPendingArea = useCallback(() => {
    if (!pendingSearchAreaBounds || isMapBoundsTooLarge(pendingSearchAreaBounds)) return;
    clearHomeTransfer();
    appliedHomeTransferIdRef.current = null;
    focusedSearchRevisionRef.current = null;
    setPendingSearchAreaBounds(null);
    setViewportAreaWarning(null);
    setPlace({ center: undefined, label: undefined, radiusKm: undefined });
    const remaining = useDiscoveryFiltersStore.getState();
    const stillSearching = checkSearchCriteria({
      place: remaining.place,
      when: remaining.when,
      content: remaining.content,
    });
    if (!stillSearching) {
      setSearchApplied(false);
    }
    viewportFrozenRef.current = false;
    clearFrozenViewport();
    void refreshBounds();
  }, [
    clearFrozenViewport,
    clearHomeTransfer,
    pendingSearchAreaBounds,
    refreshBounds,
    setPlace,
    setSearchApplied,
    setViewportAreaWarning,
    viewportFrozenRef,
  ]);

  const tightenViewportToFetchableArea = useCallback(
    (bounds: MapBounds) => {
      const nextBounds = shrinkMapBoundsToMaxDiameter(bounds, MAP_BBOX_TIGHTEN_DIAMETER_KM);
      setPendingSearchAreaBounds(null);
      setViewportAreaWarning(null);
      viewportFrozenRef.current = false;
      clearFrozenViewport();
      fitToBounds(nextBounds, { refreshAfter: true });
    },
    [clearFrozenViewport, fitToBounds, setViewportAreaWarning, viewportFrozenRef]
  );

  const handleTightenTooLargeArea = useCallback(() => {
    const bounds =
      pendingSearchAreaBounds ??
      latestVisibleBoundsRef.current ??
      frozenViewportBoundsRef.current;
    if (bounds) {
      tightenViewportToFetchableArea(bounds);
      return;
    }
    void mapRef.current?.getVisibleBounds?.().then((visible) => {
      if (visible) tightenViewportToFetchableArea(visible);
    });
  }, [frozenViewportBoundsRef, pendingSearchAreaBounds, tightenViewportToFetchableArea]);

  const toggleMapMode = useCallback(() => {
    setMapMode(mapMode === 'standard' ? 'satellite' : 'standard');
  }, [mapMode, setMapMode]);

  const hasViewportRefine =
    content.categories.length > 0 ||
    !isDefaultDiscoveryTemporal(metaFilter, when);

  const sheetCoverPx = useMemo(() => {
    if (mapColumnHeight <= 0) return VIEWPORT_PEEK_HEIGHT;
    const snaps = getSheetSnapHeights(mapColumnHeight, sheetMode);
    return snaps[Math.min(bottomSheetIndex, snaps.length - 1)] ?? VIEWPORT_PEEK_HEIGHT;
  }, [bottomSheetIndex, mapColumnHeight, sheetMode]);

  const handleSearchExpandedChange = useCallback((expanded: boolean) => {
    setSearchExpanded(expanded);
    if (expanded) {
      sheetSnapBeforeRefineRef.current = null;
      setRefineOpen(false);
    }
  }, []);

  const closeRefinePanel = useCallback(
    (options?: { restoreSheet?: boolean }) => {
      setRefineOpen(false);
      const savedSnap = sheetSnapBeforeRefineRef.current;
      sheetSnapBeforeRefineRef.current = null;
      if (options?.restoreSheet === false) return;
      const ui = useMapResultsUIStore.getState();
      if (
        savedSnap != null &&
        savedSnap >= VIEWPORT_FULL_SNAP_INDEX &&
        sheetMode === 'viewport' &&
        ui.sheetStatus !== 'singleEvent' &&
        ui.bottomSheetIndex === VIEWPORT_HALF_SNAP_INDEX
      ) {
        handleSheetIndexChange(savedSnap);
      }
    },
    [handleSheetIndexChange, sheetMode]
  );

  const openRefinePanel = useCallback(() => {
    const stored = useMapResultsUIStore.getState().bottomSheetIndex;
    const idx = resolveEffectiveSheetSnapIndex({
      storedIndex: stored,
      visibleHeight: sheetVisibleHeight.value,
      layoutHeight: mapColumnHeight,
      mode: sheetMode,
    });
    const nextSnap = sheetSnapIndexWhenOpeningRefine(idx, sheetMode);
    if (nextSnap !== stored) {
      sheetSnapBeforeRefineRef.current = Math.max(stored, idx);
      handleSheetIndexChange(nextSnap);
    } else if (idx !== nextSnap) {
      sheetSnapBeforeRefineRef.current = idx;
      setSheetSnapIndex(nextSnap, true);
    } else {
      sheetSnapBeforeRefineRef.current = null;
    }
    setRefineOpen(true);
  }, [
    handleSheetIndexChange,
    mapColumnHeight,
    setSheetSnapIndex,
    sheetMode,
    sheetVisibleHeight,
  ]);

  const toggleRefine = useCallback(() => {
    if (refineOpen) closeRefinePanel();
    else openRefinePanel();
  }, [closeRefinePanel, openRefinePanel, refineOpen]);

  const mapStyle = useMemo(() => {
    return mapMode === 'satellite' ? Mapbox.StyleURL.SatelliteStreet : Mapbox.StyleURL.Street;
  }, [mapMode]);

  // Sort at paint time so the sheet list follows SortControl even if the
  // viewport reapply path does not republish (frozen sheet / missing RPC cache).
  const displaySheetEvents = useMemo(
    () => sortEvents(sheetEvents, sortBy, sortCenter, sortOrder),
    [sheetEvents, sortBy, sortCenter, sortOrder]
  );
  const displayPeekCount = visibleEventCount;
  const openUnitEventDetails = useCallback(() => {
    if (!unitCardEvent) return;
    useMapDetailTransitionStore.getState().prepare({
      origin: 'map-unit',
      eventId: unitCardEvent.id,
      event: unitCardEvent,
      targetCardRect: null,
    });
    useEventPreviewStore.getState().prepareEventDetail(unitCardEvent);
    prefetchEventMedia(unitCardEvent, { includeGallery: true });
    router.push(`/map-event/${unitCardEvent.id}?origin=map-unit` as any);
  }, [router, unitCardEvent]);

  const openSheetEventDetails = useCallback(
    (event: EventWithCreator) => {
      sheetSnapBeforeDetailRef.current =
        useMapResultsUIStore.getState().bottomSheetIndex;
      useMapDetailTransitionStore.getState().prepare({
        origin: 'map-sheet',
        eventId: event.id,
        event,
        targetCardRect: null,
      });
      useEventPreviewStore.getState().prepareEventDetail(event);
      prefetchEventMedia(event, { includeGallery: true });
      router.push(`/map-event/${event.id}?origin=map-sheet` as any);
    },
    [router],
  );

  const showLocationOverlay =
    discoveryHydrated &&
    locationLoading &&
    !userLocation &&
    !searchActive &&
    !hasMapSnapshot;
  const showStaleMapHint = isMapSnapshotStale(mapSnapshot);
  const showLocationUnavailable =
    mapCamera.kind === 'country' &&
    !searchActive &&
    !locationLoading &&
    !userLocation &&
    (!permissionGranted || !!locationError);
  const openLocationSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <AppBackground />
      <View style={styles.screenRoot}>
        <View style={[styles.searchSlot, { paddingTop: insets.top + spacing.xs }]}>
          <View style={styles.searchHeaderRow}>
            <FloatingPressable
              style={styles.mapBackButton}
              onPress={() => router.navigate('/(tabs)' as any)}
              accessibilityRole="button"
              accessibilityLabel="Revenir à l’accueil"
              accessibilityHint="Affiche l’écran d’accueil"
              animateEntrance={false}
            >
              <ArrowLeft size={24} color={colors.brand.text} />
            </FloatingPressable>
            <View style={styles.searchBarWrap}>
              <SearchBar
                onApply={handleApplyMapSearch}
                hasLocation={!!userLocation}
                applied={searchApplied}
                surface="map"
                onExpandedChange={handleSearchExpandedChange}
              />
            </View>
            <FloatingPressable
              style={[styles.filterButton, refineOpen && styles.filterButtonOpen]}
              onPress={toggleRefine}
              accessibilityRole="button"
              accessibilityState={{ expanded: refineOpen }}
              accessibilityLabel="Filtrer les événements, filtres actifs"
              accessibilityHint="Ouvre les filtres de période et de catégorie sans lancer une recherche."
              animateEntrance={false}
            >
              <SlidersHorizontal size={20} color={colors.brand.text} />
              <View style={styles.filterActiveDot} />
            </FloatingPressable>
          </View>
        </View>

        <View
          style={styles.contentColumn}
          onLayout={(event) => {
            const height = event.nativeEvent.layout.height;
            handleColumnLayout(height);
            setMapColumnHeight((current) => (current === height ? current : height));
          }}
        >
          <View style={styles.mapLayer}>
            <MapWrapper
              ref={mapRef}
              initialRegion={mapCenter}
              userLocation={userLocation}
              onFeaturePress={handleFeaturePress}
              onZoomChange={handleZoomChange}
              styleURL={mapStyle}
              mapPadding={MAP_VIEW_PADDING}
              bottomOverlayPx={sheetCoverPx}
              maxBounds={FRANCE_CAMERA_BOUNDS}
              onVisibleBoundsChange={handleBoundsChangeWithCache}
              onUserMapGestureStart={handleUserMapGestureStart}
              onMapReady={handleMapReady}
              onMapBackgroundPress={handleMapBackgroundPress}
              activeEventId={activeEventId}
            />

            {showStaleMapHint ? (
              <View
                style={styles.mapStaleHint}
                pointerEvents="none"
                accessibilityRole="text"
                accessibilityLabel="Événements d’une précédente visite, mise à jour en cours"
              >
                <Text style={styles.mapStaleHintText}>
                  Événements d’une précédente visite — mise à jour…
                </Text>
              </View>
            ) : null}

            {showLocationOverlay ? (
              <View
                style={styles.locationOverlay}
                pointerEvents="none"
                accessibilityRole="progressbar"
                accessibilityLabel="Obtention de votre position"
                accessibilityLiveRegion="polite"
              >
                <ActivityIndicator size="large" color={colors.brand.secondary} />
                <Text style={styles.fallbackText}>Obtention de votre position...</Text>
              </View>
            ) : null}

            {showLocationUnavailable ? (
              <View
                style={styles.locationUnavailableBanner}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                <Text style={styles.locationUnavailableTitle}>Localisation indisponible</Text>
                <Text style={styles.locationUnavailableText}>
                  La carte affiche la France. Recherchez un lieu ou activez la localisation pour
                  voir les événements autour de vous.
                </Text>
                <View style={styles.locationUnavailableActions}>
                  <TouchableOpacity
                    onPress={() => void requestLocationPermission()}
                    accessibilityRole="button"
                    accessibilityLabel="Réessayer la localisation"
                  >
                    <Text style={styles.locationUnavailableAction}>Réessayer</Text>
                  </TouchableOpacity>
                  {!permissionGranted ? (
                    <TouchableOpacity
                      onPress={openLocationSettings}
                      accessibilityRole="button"
                      accessibilityLabel="Ouvrir les réglages de l'application"
                    >
                      <Text style={styles.locationUnavailableAction}>Réglages</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ) : null}

            {viewportFetchError ? (
              <View
                style={styles.mapErrorBanner}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                <Text style={styles.mapErrorText}>{viewportFetchError}</Text>
                <TouchableOpacity
                  onPress={() => setViewportFetchError(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Fermer le message d'erreur"
                >
                  <Text style={styles.mapErrorDismiss}>Fermer</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {viewportAreaWarning || pendingSearchAreaTooLarge ? (
              <TouchableOpacity
                style={[
                  styles.mapAreaWarning,
                  pendingSearchAreaBounds ? styles.mapAreaWarningBelowSearchButton : null,
                ]}
                onPress={handleTightenTooLargeArea}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLiveRegion="polite"
                accessibilityLabel="Zone trop large. Touchez pour vous rapprocher et afficher les événements."
              >
                <View style={styles.mapAreaWarningRow}>
                  <ZoomIn size={18} color={colors.brand.text} />
                  <View style={styles.mapAreaWarningCopy}>
                    <Text style={styles.mapAreaWarningTitle}>Zone trop large</Text>
                    <Text style={styles.mapAreaWarningText}>
                      Touchez pour vous rapprocher et afficher les événements.
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ) : null}

            {pendingSearchAreaBounds && !searchExpanded ? (
              <View style={styles.searchAreaButtonSlot} pointerEvents="box-none">
                <TouchableOpacity
                  style={[
                    styles.searchAreaButton,
                    pendingSearchAreaTooLarge && styles.searchAreaButtonDisabled,
                  ]}
                  onPress={handleSearchPendingArea}
                  disabled={pendingSearchAreaTooLarge}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: pendingSearchAreaTooLarge }}
                  accessibilityLabel="Rechercher les événements dans la zone visible. Les filtres quoi et quand sont conservés."
                  accessibilityHint="La recherche par lieu est remplacée par la zone actuellement affichée."
                >
                  <Text style={styles.searchAreaButtonTitle}>Rechercher dans cette zone</Text>
                  <Text style={styles.searchAreaButtonHint}>
                    Les filtres quoi et quand sont conservés
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {userLocation && !searchExpanded && !unitCardEvent ? (
              <FloatingPressable
                style={[styles.recenterTopButton, { bottom: VIEWPORT_PEEK_HEIGHT + spacing.sm }]}
                onPress={recenterToUser}
                accessibilityRole="button"
                accessibilityLabel="Recentrer sur ma position"
              >
                <Navigation size={18} color={colors.neutral[0]} />
              </FloatingPressable>
            ) : null}

            {!searchExpanded && !unitCardEvent ? (
              <FloatingPressable
                style={[
                  styles.mapStyleButton,
                  {
                    bottom:
                      VIEWPORT_PEEK_HEIGHT +
                      spacing.sm +
                      (userLocation ? 52 : 0),
                  },
                ]}
                onPress={toggleMapMode}
                accessibilityRole="button"
                accessibilityLabel={
                  mapMode === 'standard'
                    ? 'Afficher la carte satellite'
                    : 'Afficher la carte standard'
                }
                animateEntrance={false}
              >
                <Layers size={20} color={colors.brand.text} />
                {mapMode === 'satellite' ? <View style={styles.mapModeActiveDot} /> : null}
              </FloatingPressable>
            ) : null}
          </View>

          {unitCardEvent ? (
            <Animated.View
              style={styles.unitOverlaySlot}
              pointerEvents="box-none"
            >
              <MapEventUnitOverlay
                event={unitCardEvent}
                progress={unitCardModeProgress}
                currentUserId={profile?.id}
                isHearted={likesSet.has(unitCardEvent.id) || favoritesSet.has(unitCardEvent.id)}
                onToggleHeart={handleToggleHeart}
                onPress={openUnitEventDetails}
                onNavigate={() => setNavEvent(unitCardEvent)}
                onClose={() => beginUnitCardDismissal(true)}
                bottomInset={insets.bottom + spacing.sm}
              />
            </Animated.View>
          ) : null}

          <View style={styles.refineOverlay} pointerEvents="box-none">
            <MapViewportRefinePanel
              visible={refineOpen}
              searchActive={searchActive}
              metaFilter={metaFilter}
              when={when}
              selectedCategories={content.categories}
              selectedSubcategories={content.subcategories}
              onTemporalChoice={handleTemporalChoice}
              onCustomDateChange={handleCustomDateChange}
              onCategoriesChange={handleCategoriesChange}
              onClear={handleClearViewportFilters}
            />
          </View>

          <Animated.View
            pointerEvents={unitCardEvent ? 'none' : 'auto'}
            style={[styles.sheetOverlay, sheetOverlayStyle]}
          >
            <SearchResultsBottomSheet
              ref={resultsSheetRef}
              events={displaySheetEvents}
              currentUserId={profile?.id}
              activeEventId={activeEventId}
              sheetProgress={sheetProgress}
              sheetVisibleHeight={sheetVisibleHeight}
              minSheetHeight={minSheetHeightShared}
              maxSheetHeight={maxSheetHeightShared}
              layoutHeight={layoutHeightShared}
              isSheetDragging={isSheetDragging}
              onSheetDragStart={handleSheetDragStart}
              onSheetDragEnd={handleSheetDragEnd}
              onSheetSnapSettled={handleSheetSnapSettled}
              onSheetDragCancel={handleSheetDragCancel}
              onSelectEvent={(event) => selectSingleEvent(event, bottomSheetIndex)}
              onHighlightEvent={handleHighlightEvent}
              onNavigate={(event) => setNavEvent(event)}
              onOpenDetails={openSheetEventDetails}
              onOpenCreator={(creatorId) => router.push(`/community/${creatorId}` as any)}
              onToggleHeart={handleToggleHeart}
              isHearted={(id) => likesSet.has(id) || favoritesSet.has(id)}
              snapIndex={bottomSheetIndex}
              onSnapIndexChange={handleSheetIndexChange}
              mode={sheetStatus === 'singleEvent' ? 'single' : 'viewport'}
              peekCount={sheetStatus === 'singleEvent' ? 0 : displayPeekCount}
              metaFilter={metaFilter}
              isLoading={sheetStatus === 'loading'}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortByChange={(value) => setSort('map', value, sortOrder)}
              onSortChange={(value, order) => setSort('map', value, order)}
              onSortOrderChange={(value) => setSort('map', sortBy, value)}
              hasLocation={!!sortCenter}
              sortCenter={sortCenter}
              selectedCategories={content.categories}
              hasViewportRefine={hasViewportRefine}
              onClearViewportFilters={handleClearViewportFilters}
              bottomContentInset={60 + Math.max(insets.bottom, 8) + spacing.xl}
            />
          </Animated.View>
        </View>

        {discoveryHydrated && !hasMapSnapshot && !initialMapPresentationReady ? (
          <View
            style={styles.mapBootstrapOverlay}
            pointerEvents="auto"
            accessibilityRole="progressbar"
            accessibilityLabel="Préparation de la carte et des événements"
            accessibilityLiveRegion="polite"
          >
            <BrandLogoSpinner
              size={64}
              accessibilityLabel="Préparation de la carte et des événements"
            />
            <Text style={styles.mapBootstrapText}>Préparation de la carte…</Text>
          </View>
        ) : null}
      </View>

      <NavigationOptionsSheet
        visible={!!navEvent}
        event={navEvent}
        onClose={() => setNavEvent(null)}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  screenRoot: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: colors.brand.page,
  },
  searchSlot: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.brand.page,
    zIndex: 20,
  },
  searchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mapBackButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBarWrap: {
    flex: 1,
    minWidth: 0,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  filterButtonOpen: {
    borderColor: colors.brand.secondary,
  },
  filterActiveDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand.secondary,
    borderWidth: 1.5,
    borderColor: colors.brand.surface,
  },
  mapStyleButton: {
    position: 'absolute',
    right: spacing.md,
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary[200],
    zIndex: 9,
  },
  mapModeActiveDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand.secondary,
    borderWidth: 1.5,
    borderColor: colors.brand.surface,
  },
  contentColumn: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.brand.page,
  },
  refineOverlay: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.md,
    right: spacing.md,
    zIndex: 25,
    elevation: 25,
  },
  mapLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.brand.page,
  },
  sheetOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    overflow: 'hidden',
    backgroundColor: colors.brand.page,
    borderTopLeftRadius: SHEET_JUNCTION_RADIUS,
    borderTopRightRadius: SHEET_JUNCTION_RADIUS,
    minHeight: VIEWPORT_PEEK_HEIGHT,
  },
  locationOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244, 251, 246, 0.72)',
    zIndex: 20,
    gap: spacing.sm,
  },
  fallbackText: {
    marginTop: spacing.md,
    textAlign: 'center',
    color: colors.brand.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  locationUnavailableBanner: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.md,
    right: spacing.md,
    zIndex: 24,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: colors.primary[200],
    gap: spacing.xs,
  },
  locationUnavailableTitle: {
    color: colors.brand.text,
    fontSize: 14,
    fontWeight: '700',
  },
  locationUnavailableText: {
    color: colors.brand.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  locationUnavailableActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  locationUnavailableAction: {
    color: colors.brand.secondary,
    fontSize: 13,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  unitOverlaySlot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    elevation: 30,
  },
  mapBootstrapOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.brand.page,
  },
  mapBootstrapText: {
    color: colors.brand.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  mapStaleHint: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    zIndex: 20,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.brand.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  mapStaleHintText: {
    color: colors.brand.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  mapErrorBanner: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.md,
    right: spacing.md,
    zIndex: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(239, 68, 68, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  mapErrorText: {
    flex: 1,
    color: colors.brand.text,
    fontSize: 13,
    fontWeight: '600',
  },
  mapErrorDismiss: {
    color: colors.brand.text,
    fontSize: 13,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  searchAreaButtonSlot: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    zIndex: 27,
    alignItems: 'center',
  },
  searchAreaButton: {
    maxWidth: 340,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.secondary,
    borderWidth: 1,
    borderColor: colors.primary[600],
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 6,
  },
  searchAreaButtonDisabled: {
    opacity: 0.55,
  },
  searchAreaButtonTitle: {
    color: colors.brand.onAccent,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  searchAreaButtonHint: {
    color: colors.brand.onAccent,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 2,
  },
  mapAreaWarning: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.md,
    right: spacing.md,
    zIndex: 26,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.warning[50],
    borderWidth: 1,
    borderColor: colors.warning[500],
  },
  mapAreaWarningBelowSearchButton: {
    top: 82,
  },
  mapAreaWarningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mapAreaWarningCopy: {
    flex: 1,
  },
  mapAreaWarningTitle: {
    color: colors.brand.text,
    fontSize: 13,
    fontWeight: '800',
  },
  mapAreaWarningText: {
    color: colors.brand.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  recenterTopButton: {
    position: 'absolute',
    right: spacing.md,
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 4,
  },
});
