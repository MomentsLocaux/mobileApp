import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, TouchableOpacity, Linking, InteractionManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import {
  SHEET_JUNCTION_RADIUS,
  SHEET_LAYOUT_TIMING,
  SHEET_SIDE_EFFECTS_DELAY_MS,
  VIEWPORT_PEEK_HEIGHT,
  VIEWPORT_FULL_SNAP_INDEX,
  VIEWPORT_HALF_SNAP_INDEX,
  getSheetMaxSnapIndex,
  getSheetSnapHeights,
  MAP_CAMERA_ANIMATION_MS,
  shouldFollowMapCameraForSheetHeight,
  shouldFollowMapCameraForSheetIndex,
} from '../../src/utils/map-sheet-layout';
import { traceMapSheetPerf } from '@/utils/map-sheet-perf-trace';
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
import { Layers, Navigation, SlidersHorizontal } from 'lucide-react-native';
import Mapbox from '@rnmapbox/maps';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapWrapper, type MapWrapperHandle } from '../../src/components/map';
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
import { AppBackground } from '../../src/components/ui';
import {
  includesPast,
  resolveSortCenter,
  toEventFilters,
  type DiscoveryFilters,
} from '@/utils/discovery-filters';
import { isMapBoundsTooLarge } from '@/utils/map-viewport-fetch-utils';
import { MAP_BBOX_TOO_LARGE_MESSAGE } from '@/utils/bbox-event-fetch';
import {
  isDiscoverySearchActive,
  resolveHomeMapRadiusTarget,
  resolveMapHandoffMode,
  shouldApplyPendingHomeRecadrage,
  shouldRefetchViewportOnTabFocus,
} from '@/utils/map-discovery-contract';
import { resolveMapInitialCamera, shouldBootstrapViewportFetch } from '@/utils/map-camera-fallback';
import { isDefaultDiscoveryTemporal } from '@/utils/search-temporal-choice';

const SHEET_CAMERA_FOLLOW_THROTTLE_MS = 72;
const SHEET_CAMERA_FOLLOW_ANIMATION_MS = 80;

export default function MapScreen() {
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const { requestPermission: requestLocationPermission } = useLocation();

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
  const frozenViewport = useMapResultsUIStore((s) => s.frozenViewport);
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
  const clearHomeTransfer = useMapTransferStore((s) => s.clearHomeTransfer);

  const insets = useSafeAreaInsets();
  const sheetMode = sheetStatus === 'singleEvent' ? 'single' : 'viewport';
  const {
    layoutHeightShared,
    maxSheetHeightShared,
    sheetVisibleHeight,
    sheetProgress,
    isSheetDraggingRef: sheetDraggingRef,
    handleColumnLayout,
    setSheetSnapIndex,
    beginSheetDrag,
    updateSheetDrag,
    finishSheetDrag,
  } = useMapSheetSplitLayout(sheetMode, bottomSheetIndex);

  const mapRef = useRef<MapWrapperHandle>(null);
  const resultsSheetRef = useRef<SearchResultsBottomSheetHandle>(null);
  const isSheetDraggingRef = useRef(false);
  const [isSheetDragging, setIsSheetDragging] = useState(false);
  const latestVisibleBoundsRef = useRef<MapBounds | null>(null);
  const sideEffectsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSheetCameraSyncAtRef = useRef(0);
  const sheetCameraFollowActiveRef = useRef(false);
  const singleEventFocusIdRef = useRef<string | null>(null);
  const markerSelectionGuardRef = useRef(false);
  const markerSelectionGuardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomRef = useRef(12);
  const mapReadyRef = useRef(false);
  const appliedHomeTransferIdRef = useRef<string | null>(null);
  const focusedSearchRevisionRef = useRef<number | null>(null);
  const sheetSnapBeforeRefineRef = useRef<number | null>(null);

  const [navEvent, setNavEvent] = useState<EventWithCreator | null>(null);
  const [zoom, setZoom] = useState(12);
  const [unitCardEvent, setUnitCardEvent] = useState<EventWithCreator | null>(null);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);
  const [mapColumnHeight, setMapColumnHeight] = useState(0);
  const [pendingSearchAreaBounds, setPendingSearchAreaBounds] = useState<MapBounds | null>(null);
  const [mapReady, setMapReady] = useState(false);

  zoomRef.current = zoom;

  useEffect(() => {
    isSheetDraggingRef.current = isSheetDragging;
    sheetDraggingRef.current = isSheetDragging;
  }, [isSheetDragging, sheetDraggingRef]);

  useEffect(
    () => () => {
      if (sideEffectsTimerRef.current) {
        clearTimeout(sideEffectsTimerRef.current);
      }
      if (markerSelectionGuardTimerRef.current) {
        clearTimeout(markerSelectionGuardTimerRef.current);
      }
    },
    []
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

  const mapCamera = useMemo(
    () =>
      resolveMapInitialCamera({
        userLocation,
        placeCenter: place.center ?? null,
      }),
    [place.center, userLocation]
  );
  const mapCenter = {
    latitude: mapCamera.latitude,
    longitude: mapCamera.longitude,
    zoom: mapCamera.zoom,
  };

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
  const hasSearchCriteria = useMemo(
    () => checkSearchCriteria({ place, when, content }),
    [content, place, when]
  );
  const includePast = includesPast(discoveryFilters);
  const searchActive = isDiscoverySearchActive(searchApplied, hasSearchCriteria);
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
    onUnlockViewport: () => setUnitCardEvent(null),
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
    syncMapToFrozenViewport,
    lockViewportForSheet,
    unlockViewportForSheet,
    fitToRadius,
    focusOnEvent,
    viewportBootstrappedRef,
  } = viewport;

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

  const syncCameraToSheetHeight = useCallback(
    (visibleSheetHeight: number, reason: string, options?: { force?: boolean }) => {
      if (!frozenViewportBoundsRef.current) return;
      if (
        !shouldFollowMapCameraForSheetHeight(
          visibleSheetHeight,
          layoutHeightShared.value,
          sheetMode
        )
      ) {
        return;
      }

      const now = Date.now();
      if (!options?.force && now - lastSheetCameraSyncAtRef.current < SHEET_CAMERA_FOLLOW_THROTTLE_MS) {
        return;
      }

      lastSheetCameraSyncAtRef.current = now;
      sheetCameraFollowActiveRef.current = true;
      const paddingBottom = Math.max(MAP_FIT_PADDING, Math.round(visibleSheetHeight + MAP_FIT_PADDING));
      traceMapSheetPerf('syncMapToFrozenViewport', {
        reason,
        paddingBottom,
        visibleSheetHeight,
      });
      syncMapToFrozenViewport({
        paddingBottom,
        animationDuration: SHEET_CAMERA_FOLLOW_ANIMATION_MS,
      });
    },
    [frozenViewportBoundsRef, layoutHeightShared, sheetMode, syncMapToFrozenViewport]
  );

  const runSheetSideEffectsAfterSnap = useCallback(
    (targetIdx: number) => {
      if (sideEffectsTimerRef.current) {
        clearTimeout(sideEffectsTimerRef.current);
      }
      if (targetIdx === 0) {
        traceMapSheetPerf('syncMapToFrozenViewport', {
          reason: 'sheetClosing',
          paddingBottom: MAP_FIT_PADDING,
        });
        syncMapToFrozenViewport({ paddingBottom: MAP_FIT_PADDING });
      }
      sideEffectsTimerRef.current = setTimeout(() => {
        sideEffectsTimerRef.current = null;
        traceMapSheetPerf('applySheetSideEffects', { targetIdx });
        applySheetSideEffects(targetIdx);
        if (targetIdx === 0) {
          mapRef.current?.resetCameraPadding();
          return;
        }
        if (!shouldFollowMapCameraForSheetIndex(targetIdx, sheetMode)) {
          return;
        }
        const visibleSheetHeight = sheetVisibleHeight.value;
        const paddingBottom = visibleSheetHeight + MAP_FIT_PADDING;
        traceMapSheetPerf('syncMapToFrozenViewport', { paddingBottom, visibleSheetHeight });
        syncMapToFrozenViewport({ paddingBottom });
      }, SHEET_SIDE_EFFECTS_DELAY_MS);
    },
    [applySheetSideEffects, sheetMode, sheetVisibleHeight, syncMapToFrozenViewport]
  );

  const mapVisualStyle = useAnimatedStyle(() => {
    const progress = sheetProgress.value;
    return {
      opacity: interpolate(progress, [0, 1], [1, 0.9], Extrapolation.CLAMP),
      transform: [
        {
          scale: interpolate(progress, [0, 1], [1, 0.965], Extrapolation.CLAMP),
        },
        {
          translateY: interpolate(progress, [0, 1], [0, -28], Extrapolation.CLAMP),
        },
      ],
    };
  });

  const mapDimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheetProgress.value, [0, 1], [0, 0.12], Extrapolation.CLAMP),
  }));

  const sheetOverlayStyle = useAnimatedStyle(() => {
    const maxHeight = maxSheetHeightShared.value;
    const visibleHeight = sheetVisibleHeight.value;
    return {
      height: maxHeight,
      transform: [{ translateY: Math.max(0, maxHeight - visibleHeight) }],
    };
  });

  const unitOverlayFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheetProgress.value, [0, 0.35], [1, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(sheetProgress.value, [0, 0.35], [0, 24], Extrapolation.CLAMP),
      },
      {
        scale: interpolate(sheetProgress.value, [0, 0.35], [1, 0.98], Extrapolation.CLAMP),
      },
    ],
  }));

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
      lastSheetCameraSyncAtRef.current = 0;
      sheetCameraFollowActiveRef.current = false;

      if (!frozenViewportBoundsRef.current && latestVisibleBoundsRef.current) {
        frozenViewportBoundsRef.current = latestVisibleBoundsRef.current;
      }
      syncCameraToSheetHeight(sheetVisibleHeight.value, 'sheetDragStart', { force: true });
    },
    [
      beginSheetDrag,
      cancelViewportFetch,
      frozenViewportBoundsRef,
      sheetVisibleHeight,
      suppressBoundsRecalc,
      syncCameraToSheetHeight,
    ]
  );

  const handleSheetDragMove = useCallback(
    (dy: number) => {
      const nextSheetHeight = updateSheetDrag(dy);
      if (typeof nextSheetHeight === 'number') {
        syncCameraToSheetHeight(nextSheetHeight, 'sheetDragMove');
      }
    },
    [syncCameraToSheetHeight, updateSheetDrag]
  );

  const handleMapBackgroundPress = useCallback(() => {
    if (markerSelectionGuardRef.current) return;
    setUnitCardEvent(null);
    unlockViewportForSheet();
    closeSheet();
    resultsSheetRef.current?.collapseToPeek();
  }, [closeSheet, unlockViewportForSheet]);

  const handleSheetIndexChange = useCallback(
    (idx: number, options?: { animate?: boolean }) => {
      traceMapSheetPerf('handleSheetIndexChange', { idx });
      if (idx < 0) return;
      const clampedIdx = Math.min(idx, getSheetMaxSnapIndex(sheetMode));
      if (clampedIdx === bottomSheetIndex) return;

      cancelViewportFetch();
      suppressBoundsRecalc(SHEET_LAYOUT_TIMING.duration + 400);
      setBottomSheetIndex(clampedIdx);

      if (options?.animate !== false) {
        setSheetSnapIndex(clampedIdx, true);
      } else {
        setSheetSnapIndex(clampedIdx, false);
      }

      runSheetSideEffectsAfterSnap(clampedIdx);
    },
    [
      bottomSheetIndex,
      cancelViewportFetch,
      runSheetSideEffectsAfterSnap,
      setBottomSheetIndex,
      setSheetSnapIndex,
      sheetMode,
      suppressBoundsRecalc,
    ]
  );

  const collapseSheetToPeek = useCallback(() => {
    resultsSheetRef.current?.collapseToPeek();
    if (bottomSheetIndex !== 0) {
      handleSheetIndexChange(0);
    }
  }, [bottomSheetIndex, handleSheetIndexChange]);

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
    setUnitCardEvent,
    collapseSheetToPeek,
    onMarkerLoadError: setViewportFetchError,
  });

  const handleFeaturePress = useCallback(
    (id: string) => {
      markerSelectionGuardRef.current = true;
      if (markerSelectionGuardTimerRef.current) {
        clearTimeout(markerSelectionGuardTimerRef.current);
      }
      void handleMarkerFeaturePress(id).finally(() => {
        markerSelectionGuardTimerRef.current = setTimeout(() => {
          markerSelectionGuardRef.current = false;
          markerSelectionGuardTimerRef.current = null;
        }, 400);
      });
    },
    [handleMarkerFeaturePress]
  );

  useMapDeepLinkFocus(focus, handleFeaturePress);

  const handleSheetDragEnd = useCallback(
    (dy: number, velocityY: number) => {
      traceMapSheetPerf('handleSheetDragEnd', { dy, velocityY });
      const targetIdx = finishSheetDrag(dy, velocityY);
      const didFollowCameraDuringDrag = sheetCameraFollowActiveRef.current;
      sheetCameraFollowActiveRef.current = false;
      lastSheetCameraSyncAtRef.current = 0;
      setIsSheetDragging(false);

      if (targetIdx === bottomSheetIndex) {
        if (didFollowCameraDuringDrag) {
          runSheetSideEffectsAfterSnap(targetIdx);
        }
        return;
      }

      cancelViewportFetch();
      suppressBoundsRecalc(SHEET_LAYOUT_TIMING.duration + 400);
      setBottomSheetIndex(targetIdx);
      runSheetSideEffectsAfterSnap(targetIdx);
    },
    [
      bottomSheetIndex,
      cancelViewportFetch,
      finishSheetDrag,
      runSheetSideEffectsAfterSnap,
      setBottomSheetIndex,
      suppressBoundsRecalc,
    ]
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
      cancelAllMapRequests();
      viewportFrozenRef.current = false;
      clearFrozenViewport();
      setPendingSearchAreaBounds(null);
      setViewportAreaWarning(null);
      setStatus('loading');
      viewportBootstrappedRef.current = true;
      resultsSheetRef.current?.collapseToPeek();
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
  }, [reapplyClientFilters, sortBy, sortOrder]);

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
    const idx = useMapResultsUIStore.getState().bottomSheetIndex;
    if (sheetMode === 'viewport' && idx >= VIEWPORT_FULL_SNAP_INDEX) {
      sheetSnapBeforeRefineRef.current = idx;
      handleSheetIndexChange(VIEWPORT_HALF_SNAP_INDEX);
    } else {
      sheetSnapBeforeRefineRef.current = null;
    }
    setRefineOpen(true);
  }, [handleSheetIndexChange, sheetMode]);

  const toggleRefine = useCallback(() => {
    if (refineOpen) closeRefinePanel();
    else openRefinePanel();
  }, [closeRefinePanel, openRefinePanel, refineOpen]);

  const mapStyle = useMemo(() => {
    return mapMode === 'satellite' ? Mapbox.StyleURL.SatelliteStreet : Mapbox.StyleURL.Street;
  }, [mapMode]);

  const displaySheetEvents = frozenViewport?.events ?? sheetEvents;
  const displayPeekCount = frozenViewport?.eventCount ?? visibleEventCount;

  const showLocationOverlay = locationLoading && !userLocation && !searchActive;
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
              accessibilityLabel={
                hasViewportRefine
                  ? 'Filtrer les événements, filtres actifs'
                  : 'Filtrer les événements de la carte'
              }
              accessibilityHint="Ouvre les filtres de période et de catégorie sans lancer une recherche."
              animateEntrance={false}
            >
              <SlidersHorizontal size={20} color={colors.brand.text} />
              {hasViewportRefine ? <View style={styles.filterActiveDot} /> : null}
            </FloatingPressable>
          </View>
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

        <View
          style={styles.contentColumn}
          onLayout={(event) => {
            const height = event.nativeEvent.layout.height;
            handleColumnLayout(height);
            setMapColumnHeight((current) => (current === height ? current : height));
          }}
        >
          <Animated.View style={[styles.mapLayer, mapVisualStyle]}>
            <MapWrapper
              ref={mapRef}
              initialRegion={mapCenter}
              userLocation={userLocation}
              onFeaturePress={handleFeaturePress}
              onZoomChange={setZoom}
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
              <View
                style={[
                  styles.mapAreaWarning,
                  pendingSearchAreaBounds ? styles.mapAreaWarningBelowSearchButton : null,
                ]}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                <Text style={styles.mapAreaWarningTitle}>Zone trop large</Text>
                <Text style={styles.mapAreaWarningText}>
                  Rapprochez-vous pour afficher les événements.
                </Text>
              </View>
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

            {userLocation && !searchExpanded ? (
              <FloatingPressable
                style={[styles.recenterTopButton, { bottom: VIEWPORT_PEEK_HEIGHT + spacing.sm }]}
                onPress={recenterToUser}
                accessibilityRole="button"
                accessibilityLabel="Recentrer sur ma position"
              >
                <Navigation size={18} color={colors.neutral[0]} />
              </FloatingPressable>
            ) : null}

            {!searchExpanded ? (
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
          </Animated.View>

          <Animated.View pointerEvents="none" style={[styles.mapDimOverlay, mapDimStyle]} />

          {unitCardEvent ? (
            <Animated.View
              style={[styles.unitOverlaySlot, unitOverlayFadeStyle]}
              pointerEvents="box-none"
            >
              <MapEventUnitOverlay
                event={unitCardEvent}
                visible={!!unitCardEvent}
                currentUserId={profile?.id}
                isHearted={likesSet.has(unitCardEvent.id) || favoritesSet.has(unitCardEvent.id)}
                onToggleHeart={handleToggleHeart}
                onPress={() => router.push(`/events/${unitCardEvent.id}` as any)}
                onNavigate={() => setNavEvent(unitCardEvent)}
                onClose={() => {
                  setUnitCardEvent(null);
                  unlockViewportForSheet();
                  closeSheet();
                }}
                bottomInset={spacing.sm}
              />
            </Animated.View>
          ) : null}

          <Animated.View style={[styles.sheetOverlay, sheetOverlayStyle]}>
            <SearchResultsBottomSheet
              ref={resultsSheetRef}
              events={displaySheetEvents}
              currentUserId={profile?.id}
              activeEventId={activeEventId}
              isSheetDragging={isSheetDragging}
              onSheetDragStart={handleSheetDragStart}
              onSheetDragMove={handleSheetDragMove}
              onSheetDragEnd={handleSheetDragEnd}
              onSelectEvent={(event) => selectSingleEvent(event, bottomSheetIndex)}
              onHighlightEvent={handleHighlightEvent}
              onNavigate={(event) => setNavEvent(event)}
              onOpenDetails={(event) => router.push(`/events/${event.id}` as any)}
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
              hasLocation={!!userLocation}
              selectedCategories={content.categories}
              hasViewportRefine={hasViewportRefine}
              onClearViewportFilters={handleClearViewportFilters}
            />
          </Animated.View>
        </View>
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
    zIndex: 21,
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
  mapLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.brand.page,
  },
  mapDimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 2,
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
    zIndex: 5,
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
