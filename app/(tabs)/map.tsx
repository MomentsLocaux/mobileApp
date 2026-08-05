import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
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
  getSheetMaxSnapIndex,
  MAP_CAMERA_ANIMATION_MS,
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
} from '@/hooks/map';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Navigation, SlidersHorizontal } from 'lucide-react-native';
import Mapbox from '@rnmapbox/maps';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapWrapper, type MapWrapperHandle } from '../../src/components/map';
import { useAuth, useLocation } from '@/hooks';
import {
  selectDiscoveryFilters,
  useDiscoveryFiltersStore,
  useLocationStore,
  useMapResultsUIStore,
} from '../../src/store';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useLikesStore } from '@/store/likesStore';
import type { EventMetaFilter } from '../../src/utils/filter-events';
import { sortEvents } from '../../src/utils/sort-events';
import { colors, spacing, borderRadius } from '../../src/constants/theme';
import {
  FONTOY_COORDS,
  FRANCE_CAMERA_BOUNDS,
  MAP_FIT_PADDING,
  MAP_VIEW_PADDING,
  SIM_FALLBACK_COORDS,
} from '@/constants/map-screen';
import { SearchBar } from '../../src/components/search/SearchBar';
import { MapFiltersSheet, hasMapActiveFilters } from '../../src/components/search/MapFiltersSheet';
import { hasSearchCriteria as checkSearchCriteria } from '../../src/utils/search-helpers';
import {
  SearchResultsBottomSheet,
  type SearchResultsBottomSheetHandle,
} from '../../src/components/search/SearchResultsBottomSheet';
import { MapEventUnitOverlay } from '../../src/components/search/MapEventUnitOverlay';
import { FloatingPressable } from '../../src/components/ui/FloatingPressable';
import { NavigationOptionsSheet } from '../../src/components/search/NavigationOptionsSheet';
import type { DatePreset } from '@/constants/filters';
import type { EventWithCreator } from '../../src/types/database';
import { AppBackground } from '../../src/components/ui';
import {
  includesPast,
  resolveSortCenter,
  toEventFilters,
  type DiscoveryFilters,
} from '@/utils/discovery-filters';

const SHEET_CAMERA_FOLLOW_THROTTLE_MS = 72;
const SHEET_CAMERA_FOLLOW_ANIMATION_MS = 80;

export default function MapScreen() {
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  useLocation();

  const { currentLocation, isLoading: locationLoading } = useLocationStore();
  const discoveryStatus = useDiscoveryFiltersStore((s) => s.status);
  const when = useDiscoveryFiltersStore((s) => s.when);
  const place = useDiscoveryFiltersStore((s) => s.place);
  const content = useDiscoveryFiltersStore((s) => s.content);
  const sort = useDiscoveryFiltersStore((s) => s.sort);
  const mapMode = useDiscoveryFiltersStore((s) => s.mapMode);
  const searchApplied = useDiscoveryFiltersStore((s) => s.searchApplied);
  const setDiscoveryStatus = useDiscoveryFiltersStore((s) => s.setStatus);
  const setWhen = useDiscoveryFiltersStore((s) => s.setWhen);
  const setContent = useDiscoveryFiltersStore((s) => s.setContent);
  const setSort = useDiscoveryFiltersStore((s) => s.setSort);
  const setMapMode = useDiscoveryFiltersStore((s) => s.setMapMode);
  const setSearchApplied = useDiscoveryFiltersStore((s) => s.setSearchApplied);
  const commitSearch = useDiscoveryFiltersStore((s) => s.commitSearch);
  const resetCriteria = useDiscoveryFiltersStore((s) => s.resetCriteria);
  const { profile } = useAuth();
  const { favorites, toggleFavorite } = useFavoritesStore();
  const { likedEventIds, toggleLike } = useLikesStore();
  const {
    bottomSheetIndex,
    setBottomSheetIndex,
    sheetStatus,
    sheetEvents,
    visibleEventCount,
    activeEventId,
    frozenViewport,
    viewportFetchError,
    setStatus,
    setViewportFetchError,
    highlightViewportEvent,
    selectSingleEvent,
    freezeViewportResults,
    clearFrozenViewport,
    closeSheet,
    restoreViewportFromFrozen,
  } = useMapResultsUIStore();

  const insets = useSafeAreaInsets();
  const sheetMode = sheetStatus === 'singleEvent' ? 'single' : 'viewport';
  const {
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
  const filterButtonRef = useRef<View>(null);
  const isSheetDraggingRef = useRef(false);
  const [isSheetDragging, setIsSheetDragging] = useState(false);
  const latestVisibleBoundsRef = useRef<MapBounds | null>(null);
  const sideEffectsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSheetCameraSyncAtRef = useRef(0);
  const sheetCameraFollowActiveRef = useRef(false);
  const hasCenteredOnUserRef = useRef(false);
  const focusHandledRef = useRef(false);
  const singleEventFocusIdRef = useRef<string | null>(null);
  const markerSelectionGuardRef = useRef(false);
  const zoomRef = useRef(12);

  const [navEvent, setNavEvent] = useState<EventWithCreator | null>(null);
  const [zoom, setZoom] = useState(12);
  const [unitCardEvent, setUnitCardEvent] = useState<EventWithCreator | null>(null);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);

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

  const mapCenter = {
    latitude: userLocation?.latitude ?? FONTOY_COORDS.latitude,
    longitude: userLocation?.longitude ?? FONTOY_COORDS.longitude,
    zoom: 12,
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
  const searchActive = searchApplied && hasSearchCriteria;
  const searchFilters = useMemo(
    () => toEventFilters(discoveryFilters, userLocation),
    [discoveryFilters, userLocation]
  );
  const sortBy = sort.map.sortBy;
  const sortOrder = sort.map.sortOrder;
  const whenPreset = when.preset;
  const selectedCategories = content.categories;
  const selectedSubcategories = content.subcategories;
  const filtersActive = hasMapActiveFilters(discoveryFilters);
  const sortCenter = useMemo(
    () => resolveSortCenter(discoveryFilters, userLocation),
    [discoveryFilters, userLocation]
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
    fitToRadius,
    focusOnEvent,
    viewportBootstrappedRef,
  } = viewport;

  const { applySearch } = useMapSearchApply({
    filters: discoveryFilters,
    userLocation,
    syncSearchState: () => {
      reapplyClientFilters({
        metaFilter,
        searchFilters,
        searchApplied: true,
        hasSearchCriteria,
        includePast,
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
    [frozenViewportBoundsRef, syncMapToFrozenViewport]
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
        if (targetIdx > 0) {
          const visibleSheetHeight = sheetVisibleHeight.value;
          const paddingBottom = visibleSheetHeight + MAP_FIT_PADDING;
          traceMapSheetPerf('syncMapToFrozenViewport', { paddingBottom, visibleSheetHeight });
          syncMapToFrozenViewport({ paddingBottom });
        } else {
          mapRef.current?.resetCameraPadding();
        }
      }, SHEET_SIDE_EFFECTS_DELAY_MS);
    },
    [applySheetSideEffects, sheetVisibleHeight, syncMapToFrozenViewport]
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
    closeSheet();
    resultsSheetRef.current?.collapseToPeek();
  }, [closeSheet]);

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
  });

  const handleFeaturePress = useCallback(
    (id: string) => {
      markerSelectionGuardRef.current = true;
      void handleMarkerFeaturePress(id).finally(() => {
        setTimeout(() => {
          markerSelectionGuardRef.current = false;
        }, 400);
      });
    },
    [handleMarkerFeaturePress]
  );

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

  const handleWhenPresetChange = useCallback(
    (preset?: DatePreset) => {
      setWhen({
        preset,
        startDate: undefined,
        endDate: undefined,
        includePast: false,
      });
      const nextFilters = toEventFilters(
        selectDiscoveryFilters(useDiscoveryFiltersStore.getState()),
        userLocation
      );
      const nextDiscoveryFilters = selectDiscoveryFilters(useDiscoveryFiltersStore.getState());
      const nextHasSearchCriteria = checkSearchCriteria({
        place: nextDiscoveryFilters.place,
        when: nextDiscoveryFilters.when,
        content: nextDiscoveryFilters.content,
      });
      if (nextHasSearchCriteria) commitSearch();
      else setSearchApplied(false);
      if (!reapplyClientFilters({
        searchFilters: nextFilters,
        searchApplied: nextHasSearchCriteria,
        hasSearchCriteria: nextHasSearchCriteria,
        includePast: includesPast(nextDiscoveryFilters),
      })) {
        cancelViewportFetch();
        void refreshBounds();
      }
    },
    [
      cancelViewportFetch,
      commitSearch,
      reapplyClientFilters,
      refreshBounds,
      setSearchApplied,
      setWhen,
      userLocation,
    ]
  );

  const handleCategoriesChange = useCallback(
    (categories: string[], subcategories: string[]) => {
      setContent({ categories, subcategories });
      const nextDiscoveryFilters = selectDiscoveryFilters(useDiscoveryFiltersStore.getState());
      const nextFilters = toEventFilters(nextDiscoveryFilters, userLocation);
      const nextHasSearchCriteria = checkSearchCriteria({
        place: nextDiscoveryFilters.place,
        when: nextDiscoveryFilters.when,
        content: nextDiscoveryFilters.content,
      });
      if (nextHasSearchCriteria) commitSearch();
      else setSearchApplied(false);
      if (!reapplyClientFilters({
        searchFilters: nextFilters,
        searchApplied: nextHasSearchCriteria,
        hasSearchCriteria: nextHasSearchCriteria,
        includePast: includesPast(nextDiscoveryFilters),
      })) {
        cancelViewportFetch();
        void refreshBounds();
      }
    },
    [
      cancelViewportFetch,
      commitSearch,
      reapplyClientFilters,
      refreshBounds,
      setContent,
      setSearchApplied,
      userLocation,
    ]
  );

  const handleMetaFilterChange = useCallback(
    (next: EventMetaFilter) => {
      const previous = discoveryStatus;
      setDiscoveryStatus(next);
      clearFrozenViewport();
      const nextDiscoveryFilters = selectDiscoveryFilters(useDiscoveryFiltersStore.getState());
      const nextSearchFilters = toEventFilters(nextDiscoveryFilters, userLocation);
      const nextHasSearchCriteria = checkSearchCriteria({
        place: nextDiscoveryFilters.place,
        when: nextDiscoveryFilters.when,
        content: nextDiscoveryFilters.content,
      });
      const reapplied = reapplyClientFilters({
        metaFilter: next,
        searchFilters: nextSearchFilters,
        hasSearchCriteria: nextHasSearchCriteria,
        includePast: includesPast(nextDiscoveryFilters),
      });
      // Past needs a broader server timeScope than the usual "current" cache.
      // Leaving it also needs a fresh current/upcoming payload.
      if (next === 'past' || previous === 'past' || !reapplied) {
        cancelViewportFetch();
        void refreshBounds({ metaFilter: next });
      }
    },
    [
      cancelViewportFetch,
      clearFrozenViewport,
      discoveryStatus,
      reapplyClientFilters,
      refreshBounds,
      setDiscoveryStatus,
      userLocation,
    ]
  );

  const handleResetFilters = useCallback(() => {
    resetCriteria();
    clearFrozenViewport();
    const nextDiscoveryFilters = selectDiscoveryFilters(useDiscoveryFiltersStore.getState());
    reapplyClientFilters({
      metaFilter: 'all',
      searchFilters: toEventFilters(nextDiscoveryFilters, userLocation),
      searchApplied: false,
      hasSearchCriteria: false,
      includePast: false,
    });
    cancelViewportFetch();
    void refreshBounds({ metaFilter: 'all' });
  }, [
    cancelViewportFetch,
    clearFrozenViewport,
    reapplyClientFilters,
    refreshBounds,
    resetCriteria,
    userLocation,
  ]);

  const refreshBoundsRef = useRef(refreshBounds);
  refreshBoundsRef.current = refreshBounds;
  const ensureInitialViewportLoadRef = useRef(ensureInitialViewportLoad);
  ensureInitialViewportLoadRef.current = ensureInitialViewportLoad;
  const restoreViewportFromFrozenRef = useRef(restoreViewportFromFrozen);
  restoreViewportFromFrozenRef.current = restoreViewportFromFrozen;
  const setStatusRef = useRef(setStatus);
  setStatusRef.current = setStatus;
  useFocusEffect(
    useCallback(() => {
      // Keep this callback identity stable ([] + refs). Shared discovery criteria
      // must survive navigation between Home and Map.
      const uiState = useMapResultsUIStore.getState();
      if (uiState.sheetStatus === 'singleEvent' && uiState.frozenViewport) {
        restoreViewportFromFrozenRef.current({ keepHighlight: true });
      }

      const latest = useDiscoveryFiltersStore.getState();
      if (
        latest.searchApplied &&
        checkSearchCriteria({
          place: latest.place,
          when: latest.when,
          content: latest.content,
        })
      ) {
        void refreshBoundsRef.current();
        return;
      }

      if (uiState.sheetStatus !== 'loading') {
        setStatusRef.current('browsing');
      }
      resultsSheetRef.current?.collapseToPeek();
      // First open: onMapReady / location recenter own the bootstrap fetch.
      // Re-focus only: refresh the visible bbox.
      if (viewportBootstrappedRef.current) {
        void refreshBoundsRef.current();
      } else {
        void ensureInitialViewportLoadRef.current();
      }
    }, [viewportBootstrappedRef])
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

  useEffect(() => {
    if (focus && !focusHandledRef.current) {
      focusHandledRef.current = true;
      void handleFeaturePress(String(focus));
    }
  }, [focus, handleFeaturePress]);

  const recenterToUser = useCallback(() => {
    if (!userLocation) return;
    fitToRadius(userLocation.latitude, userLocation.longitude, 7.5);
  }, [fitToRadius, userLocation]);

  useEffect(() => {
    if (locationLoading) return;
    if (userLocation && !hasCenteredOnUserRef.current) {
      hasCenteredOnUserRef.current = true;
      // Camera move triggers one programmatic viewport fetch — skip ensureInitial here.
      recenterToUser();
      return;
    }
    void ensureInitialViewportLoad();
  }, [ensureInitialViewportLoad, locationLoading, recenterToUser, userLocation]);

  const handleMapReady = useCallback(() => {
    void ensureInitialViewportLoad();
  }, [ensureInitialViewportLoad]);

  useEffect(() => {
    if (!hasSearchCriteria && searchApplied) {
      setSearchApplied(false);
      void refreshBounds();
    }
  }, [hasSearchCriteria, searchApplied, refreshBounds, setSearchApplied]);

  const mapStyle = useMemo(() => {
    return mapMode === 'satellite' ? Mapbox.StyleURL.SatelliteStreet : Mapbox.StyleURL.Street;
  }, [mapMode]);

  const displaySheetEvents = frozenViewport?.events ?? sheetEvents;
  const displayPeekCount = frozenViewport?.eventCount ?? visibleEventCount;

  const sortedListEvents = useMemo(() => {
    if (sheetStatus === 'singleEvent' || sortBy === 'triage') {
      return displaySheetEvents;
    }
    return sortEvents(displaySheetEvents, sortBy, sortCenter, sortOrder);
  }, [displaySheetEvents, sheetStatus, sortBy, sortCenter, sortOrder]);

  if (locationLoading && !userLocation) {
    return (
      <GestureHandlerRootView style={styles.loadingContainer}>
        <AppBackground />
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.fallbackText}>Obtention de votre position...</Text>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <AppBackground />
      <View style={styles.screenRoot}>
        <View style={[styles.searchSlot, { paddingTop: insets.top + spacing.xs }]}>
          <View style={styles.searchHeaderRow}>
            <View style={styles.searchBarWrap}>
              <SearchBar
                onApply={applySearch}
                hasLocation={!!userLocation}
                applied={searchApplied}
                surface="map"
                onExpandedChange={setSearchExpanded}
              />
            </View>
            <View ref={filterButtonRef} collapsable={false}>
              <FloatingPressable
                style={styles.filterButton}
                onPress={() => setFiltersVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Ouvrir les filtres"
                animateEntrance={false}
              >
                <SlidersHorizontal size={20} color={colors.brand.text} />
                {filtersActive ? <View style={styles.filterActiveDot} /> : null}
              </FloatingPressable>
            </View>
          </View>
        </View>

        <View
          style={styles.contentColumn}
          onLayout={(event) => handleColumnLayout(event.nativeEvent.layout.height)}
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
              maxBounds={FRANCE_CAMERA_BOUNDS}
              onVisibleBoundsChange={handleBoundsChangeWithCache}
              onUserMapGestureStart={handleUserMapGestureStart}
              onMapReady={handleMapReady}
              onMapBackgroundPress={handleMapBackgroundPress}
              activeEventId={activeEventId}
            />

            {viewportFetchError ? (
              <View style={styles.mapErrorBanner}>
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

            {userLocation && !searchExpanded ? (
              <FloatingPressable
                style={[styles.recenterTopButton, { bottom: spacing.md }]}
                onPress={recenterToUser}
                accessibilityRole="button"
                accessibilityLabel="Recentrer sur ma position"
              >
                <Navigation size={18} color={colors.neutral[0]} />
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
                  closeSheet();
                }}
                bottomInset={spacing.sm}
              />
            </Animated.View>
          ) : null}

          <Animated.View style={[styles.sheetOverlay, sheetOverlayStyle]}>
            <SearchResultsBottomSheet
              ref={resultsSheetRef}
              events={sortedListEvents}
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
            />
          </Animated.View>
        </View>
      </View>

      <MapFiltersSheet
        visible={filtersVisible}
        anchorRef={filterButtonRef}
        onClose={() => setFiltersVisible(false)}
        metaFilter={metaFilter}
        onMetaFilterChange={handleMetaFilterChange}
        mapMode={mapMode}
        onMapModeChange={setMapMode}
        searchActive={searchActive}
        filters={discoveryFilters}
        whenPreset={whenPreset}
        onWhenPresetChange={handleWhenPresetChange}
        selectedCategories={selectedCategories}
        selectedSubcategories={selectedSubcategories}
        onCategoriesChange={handleCategoriesChange}
        onReset={handleResetFilters}
        resultCount={displayPeekCount}
        isLoadingResults={sheetStatus === 'loading'}
      />

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
    borderColor: 'rgba(255,255,255,0.1)',
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    gap: spacing.sm,
  },
  fallbackText: {
    marginTop: spacing.md,
    textAlign: 'center',
    color: colors.brand.textSecondary,
    fontSize: 16,
    fontWeight: '600',
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
