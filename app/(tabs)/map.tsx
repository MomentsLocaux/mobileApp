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
import { useSearchThisArea } from '@/hooks/map/useSearchThisArea';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LocateFixed, SlidersHorizontal, Search } from 'lucide-react-native';
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
  MAP_RECENTER_USER_RADIUS_KM,
  MAP_VIEW_PADDING,
  SIM_FALLBACK_COORDS,
  clampMapRecenterRadiusKm,
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
  const clearSearchCriteria = useDiscoveryFiltersStore((s) => s.clearSearchCriteria);
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
  const mapViewportSizeRef = useRef<{ width: number; height: number } | null>(null);
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

  const searchThisAreaHandlersRef = useRef<{
    onUserCameraSettled: (bounds: MapBounds) => void;
    markZoneSearched: (bounds: MapBounds) => void;
  }>({
    onUserCameraSettled: () => undefined,
    markZoneSearched: () => undefined,
  });

  const { fetch, viewport, viewportFrozenRef, frozenViewportBoundsRef } = useMapScreenData({
    mapRef,
    isSheetDraggingRef,
    zoomRef,
    clearFrozenViewport,
    freezeViewportResults,
    onUnlockViewport: () => setUnitCardEvent(null),
    onUserViewportMoved: (bounds) => searchThisAreaHandlersRef.current.onUserCameraSettled(bounds),
    onViewportSearched: (bounds) => searchThisAreaHandlersRef.current.markZoneSearched(bounds),
    getMapViewportSize: () => mapViewportSizeRef.current,
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
    refreshWithBounds,
    syncMapToFrozenViewport,
    lockViewportForSheet,
    fitToRadius,
    focusOnEvent,
    unlockViewportFreeze,
    viewportBootstrappedRef,
  } = viewport;

  const {
    showSearchThisArea,
    markZoneSearched,
    onUserCameraSettled,
    searchThisArea,
  } = useSearchThisArea({
    searchBounds: (bounds) => {
      cancelViewportFetch();
      unlockViewportFreeze();

      // Drop modal search (place / when / content) so the bbox owns the query.
      if (useDiscoveryFiltersStore.getState().searchApplied) {
        clearSearchCriteria();
        const nextFilters = selectDiscoveryFilters(useDiscoveryFiltersStore.getState());
        reapplyClientFilters({
          metaFilter,
          searchFilters: toEventFilters(nextFilters, userLocation),
          searchApplied: false,
          hasSearchCriteria: false,
          includePast: false,
        });
      }

      refreshWithBounds(bounds, { applyChromeInset: true });
    },
    getZoom: () => zoomRef.current,
  });

  searchThisAreaHandlersRef.current = {
    onUserCameraSettled: (bounds) => onUserCameraSettled(bounds, zoomRef.current),
    markZoneSearched: (bounds) => markZoneSearched(bounds, zoomRef.current),
  };

  const { applySearch: applySearchBase, resolveSearchTargetBounds, moveMapToSearchBounds } =
    useMapSearchApply({
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
  const moveMapToSearchBoundsRef = useRef(moveMapToSearchBounds);
  moveMapToSearchBoundsRef.current = moveMapToSearchBounds;
  const userLocationRef = useRef(userLocation);
  userLocationRef.current = userLocation;
  const fittedSearchRevisionRef = useRef<number | null>(null);
  const recenterRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationLoadingRef = useRef(locationLoading);
  locationLoadingRef.current = locationLoading;

  const scheduleRefreshWithBounds = useCallback(
    (bounds: MapBounds) => {
      if (recenterRefreshTimerRef.current) {
        clearTimeout(recenterRefreshTimerRef.current);
      }
      recenterRefreshTimerRef.current = setTimeout(() => {
        recenterRefreshTimerRef.current = null;
        refreshWithBounds(bounds);
      }, MAP_CAMERA_ANIMATION_MS + 250);
    },
    [refreshWithBounds]
  );

  useEffect(
    () => () => {
      if (recenterRefreshTimerRef.current) {
        clearTimeout(recenterRefreshTimerRef.current);
      }
    },
    []
  );

  const applySearch = useCallback(() => {
    unlockViewportFreeze();
    const fittedBounds = applySearchBase();
    fittedSearchRevisionRef.current = useDiscoveryFiltersStore.getState().searchRevision;
    if (fittedBounds) {
      scheduleRefreshWithBounds(fittedBounds);
    }
  }, [applySearchBase, scheduleRefreshWithBounds, unlockViewportFreeze]);

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
        // Peek: allow counts/markers to follow live viewport again.
        unlockViewportFreeze();
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
    [applySheetSideEffects, sheetVisibleHeight, syncMapToFrozenViewport, unlockViewportFreeze]
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

  /** Keep the locate FAB above the results sheet peek / expanded height. */
  const recenterFabStyle = useAnimatedStyle(() => ({
    bottom: Math.max(VIEWPORT_PEEK_HEIGHT, sheetVisibleHeight.value) + spacing.md,
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
      unlockViewportFreeze();
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
      unlockViewportFreeze,
      userLocation,
    ]
  );

  const handleCategoriesChange = useCallback(
    (categories: string[], subcategories: string[]) => {
      unlockViewportFreeze();
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
      unlockViewportFreeze,
      userLocation,
    ]
  );

  const handleMetaFilterChange = useCallback(
    (next: EventMetaFilter) => {
      const previous = discoveryStatus;
      unlockViewportFreeze();
      setDiscoveryStatus(next);
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
      discoveryStatus,
      reapplyClientFilters,
      refreshBounds,
      setDiscoveryStatus,
      unlockViewportFreeze,
      userLocation,
    ]
  );

  const handleResetFilters = useCallback(() => {
    unlockViewportFreeze();
    resetCriteria();
    fittedSearchRevisionRef.current = null;
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
    unlockViewportFreeze,
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
  const unlockViewportFreezeRef = useRef(unlockViewportFreeze);
  unlockViewportFreezeRef.current = unlockViewportFreeze;
  const scheduleRefreshWithBoundsRef = useRef(scheduleRefreshWithBounds);
  scheduleRefreshWithBoundsRef.current = scheduleRefreshWithBounds;
  useFocusEffect(
    useCallback(() => {
      // Keep this callback identity stable ([] + refs). Shared discovery criteria
      // must survive navigation between Home and Map.
      const uiState = useMapResultsUIStore.getState();
      if (uiState.sheetStatus === 'singleEvent' && uiState.frozenViewport) {
        restoreViewportFromFrozenRef.current({ keepHighlight: true });
      }

      const latest = useDiscoveryFiltersStore.getState();
      const hasCriteria = checkSearchCriteria({
        place: latest.place,
        when: latest.when,
        content: latest.content,
      });

      if (latest.searchApplied && hasCriteria) {
        // Home Apply commits criteria without moving the map camera. On focus,
        // fit once per searchRevision so the viewport matches the search disk.
        const filters = selectDiscoveryFilters(latest);
        const target = resolveSearchTargetBounds(filters, userLocationRef.current);
        if (
          target &&
          fittedSearchRevisionRef.current !== latest.searchRevision
        ) {
          fittedSearchRevisionRef.current = latest.searchRevision;
          setStatusRef.current('loading');
          unlockViewportFreezeRef.current();
          const fittedBounds = moveMapToSearchBoundsRef.current(target);
          scheduleRefreshWithBoundsRef.current(fittedBounds);
          return;
        }
        void refreshBoundsRef.current();
        return;
      }

      if (uiState.sheetStatus !== 'loading') {
        setStatusRef.current('browsing');
      }
      resultsSheetRef.current?.collapseToPeek();

      // First paint ownership: GPS recenter OR ensureInitial — not both.
      if (viewportBootstrappedRef.current) {
        void refreshBoundsRef.current();
        return;
      }
      if (locationLoadingRef.current) return;
      if (userLocationRef.current) return;
      void ensureInitialViewportLoadRef.current();
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

  const recenterToUser = useCallback((): MapBounds | null => {
    if (!userLocation) return null;
    unlockViewportFreeze();
    return fitToRadius(
      userLocation.latitude,
      userLocation.longitude,
      MAP_RECENTER_USER_RADIUS_KM
    );
  }, [fitToRadius, unlockViewportFreeze, userLocation]);

  /** Search disk (clamped 1–20 km) if applied, otherwise user neighborhood disk. */
  const handleRecenterPress = useCallback(() => {
    cancelViewportFetch();
    unlockViewportFreeze();

    if (searchActive) {
      const latest = useDiscoveryFiltersStore.getState();
      const target = resolveSearchTargetBounds(
        selectDiscoveryFilters(latest),
        userLocation
      );
      if (target) {
        const radiusKm = clampMapRecenterRadiusKm(target.radiusKm);
        fittedSearchRevisionRef.current = latest.searchRevision;
        setStatus('loading');
        const fittedBounds = fitToRadius(target.latitude, target.longitude, radiusKm);
        scheduleRefreshWithBounds(fittedBounds);
        return;
      }
    }

    const fittedBounds = recenterToUser();
    if (fittedBounds) {
      scheduleRefreshWithBounds(fittedBounds);
    }
  }, [
    cancelViewportFetch,
    fitToRadius,
    recenterToUser,
    resolveSearchTargetBounds,
    scheduleRefreshWithBounds,
    searchActive,
    setStatus,
    unlockViewportFreeze,
    userLocation,
  ]);

  const canShowRecenterButton =
    !searchExpanded &&
    (Boolean(userLocation) ||
      (searchActive &&
        Boolean(
          resolveSearchTargetBounds(discoveryFilters, userLocation)
        )));

  const recenterAccessibilityLabel = searchActive
    ? 'Recentrer sur la zone de recherche'
    : 'Recentrer sur ma position';

  useEffect(() => {
    // Wait for location resolution so we don't race a France-wide ensureInitial
    // against the GPS neighborhood fit.
    if (locationLoading) return;

    if (userLocation && !hasCenteredOnUserRef.current) {
      hasCenteredOnUserRef.current = true;
      const fittedBounds = recenterToUser();
      if (fittedBounds) {
        scheduleRefreshWithBounds(fittedBounds);
      }
      return;
    }

    if (!userLocation && !viewportBootstrappedRef.current) {
      void ensureInitialViewportLoad();
    }
  }, [
    ensureInitialViewportLoad,
    locationLoading,
    recenterToUser,
    scheduleRefreshWithBounds,
    userLocation,
    viewportBootstrappedRef,
  ]);

  const handleMapReady = useCallback(() => {
    // GPS path owns first paint when a fix exists or is still loading.
    if (viewportBootstrappedRef.current || hasCenteredOnUserRef.current) return;
    if (locationLoadingRef.current || userLocationRef.current) return;
    void ensureInitialViewportLoad();
  }, [ensureInitialViewportLoad, viewportBootstrappedRef]);

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

  const showLocationOverlay = locationLoading && !userLocation;

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
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            if (width > 0 && height > 0) {
              mapViewportSizeRef.current = { width, height };
            }
            handleColumnLayout(height);
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
              maxBounds={FRANCE_CAMERA_BOUNDS}
              onVisibleBoundsChange={handleBoundsChangeWithCache}
              onUserMapGestureStart={handleUserMapGestureStart}
              onMapReady={handleMapReady}
              onMapBackgroundPress={handleMapBackgroundPress}
              activeEventId={activeEventId}
            />

            {showLocationOverlay ? (
              <View style={styles.locationOverlay} pointerEvents="none">
                <ActivityIndicator size="large" color={colors.brand.secondary} />
                <Text style={styles.fallbackText}>Obtention de votre position...</Text>
              </View>
            ) : null}

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

            {showSearchThisArea && !searchExpanded && sheetStatus !== 'loading' ? (
              <View style={styles.searchThisAreaSlot} pointerEvents="box-none">
                <FloatingPressable
                  style={styles.searchThisAreaChip}
                  onPress={searchThisArea}
                  accessibilityRole="button"
                  accessibilityLabel="Rechercher dans cette zone"
                  animateEntrance={false}
                >
                  <Search size={16} color={colors.brand.onAccent} strokeWidth={2.4} />
                  <Text style={styles.searchThisAreaText}>Rechercher dans cette zone</Text>
                </FloatingPressable>
              </View>
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

          {canShowRecenterButton ? (
            <Animated.View
              style={[styles.recenterFabSlot, recenterFabStyle]}
              pointerEvents="box-none"
            >
              <FloatingPressable
                style={styles.recenterFab}
                onPress={handleRecenterPress}
                accessibilityRole="button"
                accessibilityLabel={recenterAccessibilityLabel}
                animateEntrance={false}
              >
                <LocateFixed size={20} color={colors.brand.onAccent} />
              </FloatingPressable>
            </Animated.View>
          ) : null}
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
  searchThisAreaSlot: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    alignItems: 'center',
    zIndex: 28,
  },
  searchThisAreaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.secondary,
  },
  searchThisAreaText: {
    color: colors.brand.onAccent,
    fontSize: 14,
    fontWeight: '700',
  },
  recenterFabSlot: {
    position: 'absolute',
    right: spacing.md,
    zIndex: 30,
  },
  recenterFab: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
