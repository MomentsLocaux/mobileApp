import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { SHEET_JUNCTION_RADIUS, VIEWPORT_PEEK_HEIGHT } from '../../src/utils/map-sheet-layout';
import { useMapSheetSplitLayout } from '@/hooks/useMapSheetSplitLayout';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Navigation, PlusCircle, SlidersHorizontal } from 'lucide-react-native';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import Mapbox from '@rnmapbox/maps';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapWrapper, type MapWrapperHandle } from '../../src/components/map';
import { EventsService } from '../../src/services/events.service';
import { SocialService } from '../../src/services/social.service';
import { useAuth, useLocation } from '@/hooks';
import { useLocationStore, useSearchStore, useMapResultsUIStore } from '../../src/store';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useLikesStore } from '@/store/likesStore';
import { buildFiltersFromSearch } from '../../src/utils/search-filters';
import { filterEvents, filterEventsByMetaStatus, type EventMetaFilter } from '../../src/utils/filter-events';
import { sortEvents } from '../../src/utils/sort-events';
import { colors, spacing, borderRadius, typography } from '../../src/constants/theme';
import { SearchBar } from '../../src/components/search/SearchBar';
import { MapFiltersSheet, hasMapActiveFilters } from '../../src/components/search/MapFiltersSheet';
import {
  getBoundsFromRadiusKm,
  hasSearchCriteria as checkSearchCriteria,
  resolveEffectiveRadiusKm,
  SEARCH_FETCH_LIMIT,
} from '../../src/utils/search-helpers';
import { resolveEventTimeScope } from '../../src/utils/event-time-scope';
import {
  SearchResultsBottomSheet,
  type SearchResultsBottomSheetHandle,
} from '../../src/components/search/SearchResultsBottomSheet';
import { MapEventUnitOverlay } from '../../src/components/search/MapEventUnitOverlay';
import { NavigationOptionsSheet } from '../../src/components/search/NavigationOptionsSheet';
import type { EventWithCreator } from '../../src/types/database';
import { AppBackground } from '../../src/components/ui';

const FONTOY_COORDS = { latitude: 49.3247, longitude: 5.9947 };
const SIM_FALLBACK_COORDS = { latitude: 37.785834, longitude: -122.406417 };

export default function MapScreen() {
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  useLocation();
  const { currentLocation, isLoading: locationLoading } = useLocationStore();
  const searchState = useSearchStore();
  const { profile, isAuthenticated } = useAuth();
  const { favorites, toggleFavorite } = useFavoritesStore();
  const { likedEventIds, toggleLike } = useLikesStore();
  const {
    bottomSheetIndex,
    setBottomSheetIndex,
    sheetStatus,
    sheetEvents,
    visibleEventCount,
    activeEventId,
    setStatus,
    displayViewportResults,
    highlightViewportEvent,
    selectSingleEvent,
    closeSheet,
  } = useMapResultsUIStore();
  const insets = useSafeAreaInsets();
  const sheetMode = sheetStatus === 'singleEvent' ? 'single' : 'viewport';
  const {
    snapHeights,
    isSheetDragging,
    mapSlotHeight,
    handleColumnLayout,
    setSheetSnapIndex,
    beginSheetDrag,
    updateSheetDrag,
    finishSheetDrag,
  } = useMapSheetSplitLayout(sheetMode);

  const mapSlotStyle = useAnimatedStyle(() => ({
    height: Math.max(0, mapSlotHeight.value),
  }));

  const mapPaddingBottomRef = useRef(20);

  const [navEvent, setNavEvent] = useState<any | null>(null);
  const [zoom, setZoom] = useState(12);
  const isProgrammaticMoveRef = useRef(false);
  const hasCenteredOnUserRef = useRef(false);
  const mapRef = useRef<MapWrapperHandle>(null);
  const resultsSheetRef = useRef<SearchResultsBottomSheetHandle>(null);
  const filterButtonRef = useRef<View>(null);
  const [unitCardEvent, setUnitCardEvent] = useState<EventWithCreator | null>(null);
  const [mapMode, setMapMode] = useState<'standard' | 'satellite'>('standard');
  const includePast = !!searchState.when.includePast;
  const focusHandledRef = useRef(false);
  const bboxTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportRequestIdRef = useRef(0);
  const markerRequestIdRef = useRef(0);
  const viewportFrozenRef = useRef(false);
  const pendingProgrammaticRefreshRef = useRef(false);
  const eventCacheRef = useRef<Map<string, EventWithCreator>>(new Map());
  const searchApplied = searchState.searchApplied;
  const setSearchApplied = searchState.setSearchApplied;
  const commitSearch = searchState.commitSearch;
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [guestGateVisible, setGuestGateVisible] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [metaFilter, setMetaFilter] = useState<EventMetaFilter>('all');
  const initialViewportLoadInFlightRef = useRef(false);
  const singleEventFocusIdRef = useRef<string | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

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

  const mapPadding = useMemo(
    () => ({ top: 20, right: 20, bottom: 20, left: 20 }),
    []
  );

  const getFitPadding = useCallback(() => 20, []);

  const hasSearchCriteria = useMemo(() => checkSearchCriteria(searchState), [searchState]);

  const searchActive = metaFilter === 'all' && searchApplied && hasSearchCriteria;
  const searchFilters = useMemo(() => buildFiltersFromSearch(searchState, userLocation), [searchState, userLocation]);
  const sortBy = searchState.sortBy || 'triage';
  const sortOrder = searchState.sortOrder;
  const filtersActive = hasMapActiveFilters(metaFilter, mapMode, searchActive, sortBy);
  const sortCenter = useMemo(
    () =>
      searchState.where.location
        ? { latitude: searchState.where.location.latitude, longitude: searchState.where.location.longitude }
        : userLocation,
    [searchState.where.location, userLocation]
  );

  const runViewportFetch = useCallback(
    async (bounds: { ne: [number, number]; sw: [number, number] }, requestId: number) => {
      if (requestId !== viewportRequestIdRef.current) return;
      setStatus('loading');
      try {
        const effectiveSearchActive = metaFilter === 'all' && searchApplied && hasSearchCriteria;
        const bboxTimeScope = resolveEventTimeScope({
          metaFilter,
          searchActive: effectiveSearchActive,
          includePast,
        });
        const effectiveFilters = effectiveSearchActive ? searchFilters : {};

        const featureCollection = await EventsService.listEventsByBBox({
          ne: bounds.ne,
          sw: bounds.sw,
          limit: SEARCH_FETCH_LIMIT,
          timeScope: bboxTimeScope,
        });

        if (requestId !== viewportRequestIdRef.current) return;

        const ids = featureCollection?.features?.map((f: any) => f?.properties?.id).filter(Boolean) || [];
        const uniqueIds = Array.from(new Set(ids)) as string[];
        const events = uniqueIds.length ? await EventsService.getEventsByIds(uniqueIds) : [];

        if (requestId !== viewportRequestIdRef.current) return;

        const filteredEvents = effectiveSearchActive
          ? filterEvents(events, effectiveFilters, null)
          : metaFilter === 'all' || metaFilter === 'past' || metaFilter === 'upcoming'
            ? events
            : filterEvents(events, {}, null);
        const metaFilteredEvents = filterEventsByMetaStatus(filteredEvents, metaFilter);
        const sortedEvents = effectiveSearchActive
          ? sortEvents(metaFilteredEvents, sortBy, sortCenter, sortOrder)
          : metaFilteredEvents;
        const dedupedEvents = Array.from(new Map(sortedEvents.map((event) => [event.id, event])).values());

        const filteredIds = new Set(dedupedEvents.map((e) => e.id));
        const filteredFeatures = (featureCollection?.features || []).filter((f: any) =>
          filteredIds.has(f?.properties?.id)
        );

        if (requestId !== viewportRequestIdRef.current) return;
        mapRef.current?.setShape({ type: 'FeatureCollection', features: filteredFeatures } as any);
        const currentUiState = useMapResultsUIStore.getState();
        if (currentUiState.sheetStatus === 'singleEvent') return;
        displayViewportResults(dedupedEvents);
      } catch (e) {
        if (requestId !== viewportRequestIdRef.current) return;
        console.warn('bbox fetch error', e);
        setStatus('browsing');
      }
    },
    [
      metaFilter,
      searchApplied,
      hasSearchCriteria,
      includePast,
      searchFilters,
      sortBy,
      sortOrder,
      sortCenter,
      setStatus,
      displayViewportResults,
    ]
  );

  const queueViewportFetch = useCallback(
    (
      bounds: { ne: [number, number]; sw: [number, number] },
      options?: { immediate?: boolean; force?: boolean }
    ) => {
      if (viewportFrozenRef.current && !options?.force) return;
      if (isProgrammaticMoveRef.current && !options?.force) return;
      if (bboxTimeoutRef.current) clearTimeout(bboxTimeoutRef.current);
      const requestId = ++viewportRequestIdRef.current;
      setStatus('browsing');

      const execute = () => {
        void runViewportFetch(bounds, requestId);
      };

      if (options?.immediate) {
        execute();
        return;
      }

      bboxTimeoutRef.current = setTimeout(execute, 300);
    },
    [runViewportFetch, setStatus]
  );

  const handleBoundsChange = useCallback(
    (bounds: { ne: [number, number]; sw: [number, number] }, options?: { forceSearchRadius?: boolean }) => {
      if (isProgrammaticMoveRef.current) {
        isProgrammaticMoveRef.current = false;
        mapRef.current?.clearBoundsCache?.();
        if (pendingProgrammaticRefreshRef.current) {
          pendingProgrammaticRefreshRef.current = false;
          queueViewportFetch(bounds, { immediate: true, force: true });
        }
        return;
      }

      if (viewportFrozenRef.current) {
        return;
      }
      queueViewportFetch(bounds, { force: options?.forceSearchRadius });
    },
    [queueViewportFetch]
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
  }, [queueViewportFetch]);

  const refreshBounds = useCallback(async () => {
    const bounds = await mapRef.current?.getVisibleBounds?.();
    if (bounds) {
      isProgrammaticMoveRef.current = false;
      mapRef.current?.clearBoundsCache?.();
      queueViewportFetch(bounds, { immediate: true, force: true });
    }
  }, [queueViewportFetch]);

  useFocusEffect(
    useCallback(() => {
      if (!searchApplied || !hasSearchCriteria) {
        setStatus('browsing');
        resultsSheetRef.current?.collapseToPeek();
      }
      if (searchApplied && hasSearchCriteria) {
        refreshBounds();
        return;
      }
      const { visibleEventCount: count, sheetStatus } = useMapResultsUIStore.getState();
      if (count === 0 && sheetStatus !== 'singleEvent') {
        void ensureInitialViewportLoad();
      }
    }, [ensureInitialViewportLoad, hasSearchCriteria, refreshBounds, searchApplied, setStatus])
  );

  const withProgrammaticMove = useCallback(
    (moveFn: () => void, options?: { refreshAfter?: boolean }) => {
      isProgrammaticMoveRef.current = true;
      pendingProgrammaticRefreshRef.current = options?.refreshAfter !== false;
      moveFn();
    },
    []
  );

  const fitToRadius = useCallback(
    (latitude: number, longitude: number, radiusKm: number) => {
      const bounds = getBoundsFromRadiusKm(latitude, longitude, radiusKm);
      const coords = [
        { latitude: bounds.sw[1], longitude: bounds.sw[0] },
        { latitude: bounds.ne[1], longitude: bounds.ne[0] },
      ];
      const fitPadding = getFitPadding();
      withProgrammaticMove(() => mapRef.current?.fitToCoordinates(coords, fitPadding));
      return bounds;
    },
    [getFitPadding, withProgrammaticMove]
  );

  const applySearch = useCallback(() => {
    setMetaFilter('all');
    commitSearch();
    setStatus('loading');
    const location = searchState.where.location;
    const effectiveRadius = resolveEffectiveRadiusKm(searchState.where, userLocation) ?? 10;

    const moveAction = () => {
      if (location) {
        return fitToRadius(location.latitude, location.longitude, effectiveRadius);
      }
      if (searchState.where.radiusKm !== undefined && userLocation) {
        return fitToRadius(userLocation.latitude, userLocation.longitude, effectiveRadius);
      }
      return null;
    };

    if (!moveAction()) {
      refreshBounds();
    }
  }, [commitSearch, fitToRadius, refreshBounds, searchState.where, userLocation, setStatus]);

  const focusOnEvent = useCallback(
    (event: EventWithCreator, _snapIndex: number, options?: { bumpZoom?: boolean }) => {
      if (!event || typeof event.longitude !== 'number' || typeof event.latitude !== 'number') return;
      const paddingBottom = mapPaddingBottomRef.current;
      const targetZoom = options?.bumpZoom === false ? zoomRef.current : Math.max(zoomRef.current, 14);
      withProgrammaticMove(
        () => {
          mapRef.current?.focusOnCoordinate({
            longitude: event.longitude,
            latitude: event.latitude,
            zoom: targetZoom,
            paddingBottom,
          });
        },
        { refreshAfter: false }
      );
    },
    [withProgrammaticMove]
  );

  const handleHighlightEvent = useCallback(
    (event: EventWithCreator, options?: { focusMap?: boolean }) => {
      eventCacheRef.current.set(event.id, event);
      highlightViewportEvent(event);
      if (options?.focusMap === false) return;
      focusOnEvent(event, bottomSheetIndex, { bumpZoom: false });
    },
    [bottomSheetIndex, focusOnEvent, highlightViewportEvent]
  );

  const handleFeaturePress = useCallback(
    async (id: string) => {
      const requestId = ++markerRequestIdRef.current;
      viewportRequestIdRef.current += 1;
      if (bboxTimeoutRef.current) {
        clearTimeout(bboxTimeoutRef.current);
        bboxTimeoutRef.current = null;
      }

      try {
        const cached = eventCacheRef.current.get(id) ?? sheetEvents.find((event) => event.id === id);
        const evt = cached ?? (await EventsService.getEventById(id));

        if (requestId !== markerRequestIdRef.current) return;
        if (!evt) return;

        eventCacheRef.current.set(id, evt);

        highlightViewportEvent(evt);
        setUnitCardEvent(evt);
        viewportFrozenRef.current = true;
        focusOnEvent(evt, 0, { bumpZoom: false });
      } catch (e) {
        if (requestId !== markerRequestIdRef.current) return;
        console.warn('getEventById error', e);
      }
    },
    [focusOnEvent, highlightViewportEvent, sheetEvents]
  );

  const handleMapBackgroundPress = useCallback(() => {
    setUnitCardEvent(null);
    viewportFrozenRef.current = false;
    closeSheet();
    resultsSheetRef.current?.collapseToPeek();
  }, [closeSheet]);

  const handleSheetIndexChange = useCallback(
    (idx: number, options?: { animate?: boolean }) => {
      if (idx < 0) return;
      setBottomSheetIndex(idx);
      if (options?.animate !== false) {
        setSheetSnapIndex(idx);
      }

      if (idx === 0) {
        viewportFrozenRef.current = false;
        closeSheet();
      } else {
        setUnitCardEvent(null);
        viewportFrozenRef.current = true;
      }

      if (idx > 0 && sheetStatus === 'singleEvent' && sheetEvents.length > 0) {
        focusOnEvent(sheetEvents[0], idx, { bumpZoom: false });
      }

      if (idx >= 2 && activeEventId) {
        resultsSheetRef.current?.scrollToEvent(activeEventId);
      }
    },
    [
      activeEventId,
      closeSheet,
      focusOnEvent,
      setBottomSheetIndex,
      sheetEvents,
      sheetStatus,
      setSheetSnapIndex,
    ]
  );

  const handleSheetDragEnd = useCallback(
    (dy: number, velocityY: number) => {
      const targetIdx = finishSheetDrag(dy, velocityY);
      handleSheetIndexChange(targetIdx, { animate: false });
    },
    [finishSheetDrag, handleSheetIndexChange]
  );

  const handleBackToList = useCallback(() => {
    router.push('/(tabs)/' as any);
  }, [router]);

  const handleMetaFilterChange = useCallback(
    (next: EventMetaFilter) => {
      setMetaFilter(next);
      if (next !== 'all') {
        setSearchApplied(false);
      }
      refreshBounds();
    },
    [refreshBounds, setSearchApplied]
  );

  const handleCreateEvent = useCallback(() => {
    if (!isAuthenticated) {
      setGuestGateVisible(true);
      return;
    }
    router.push('/events/create/step-1' as any);
  }, [isAuthenticated, router]);

  useEffect(() => {
    return () => {
      if (bboxTimeoutRef.current) {
        clearTimeout(bboxTimeoutRef.current);
      }
      viewportRequestIdRef.current += 1;
      markerRequestIdRef.current += 1;
    };
  }, []);

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
    focusOnEvent(sheetEvents[0], targetIndex, { bumpZoom: true });
    resultsSheetRef.current?.open?.(targetIndex);
  }, [sheetStatus, activeEventId, sheetEvents, focusOnEvent]);

  // Handle deep-linked event focus
  useEffect(() => {
    if (focus && !focusHandledRef.current) {
      focusHandledRef.current = true;
      handleFeaturePress(String(focus));
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
      recenterToUser();
    }
    void ensureInitialViewportLoad();
  }, [ensureInitialViewportLoad, locationLoading, recenterToUser, userLocation]);

  const handleMapReady = useCallback(() => {
    void ensureInitialViewportLoad();
  }, [ensureInitialViewportLoad]);

  useEffect(() => {
    if (!hasSearchCriteria && searchApplied) {
      setSearchApplied(false);
      refreshBounds();
    }
  }, [hasSearchCriteria, searchApplied, refreshBounds, setSearchApplied]);

  const mapStyle = useMemo(() => {
    return mapMode === 'satellite' ? Mapbox.StyleURL.SatelliteStreet : Mapbox.StyleURL.Street;
  }, [mapMode]);

  const favoritesSet = useMemo(() => new Set(favorites.map((f) => f.id)), [favorites]);
  const likesSet = useMemo(() => new Set(likedEventIds), [likedEventIds]);

  const handleToggleLike = useCallback(
    async (event: EventWithCreator) => {
      try {
        const nowLiked = await SocialService.like(profile?.id || '', event.id);
        const wasLiked = likesSet.has(event.id);
        if (nowLiked !== wasLiked) {
          toggleLike(event.id);
        }
      } catch (e) {
        console.warn('toggle like error', e);
      }
    },
    [likesSet, profile?.id, toggleLike]
  );

  const handleToggleFavorite = useCallback(
    async (event: EventWithCreator) => {
      try {
        const nowFavorited = await SocialService.toggleFavorite(profile?.id || '', event.id);
        const wasFavorited = favoritesSet.has(event.id);
        if (nowFavorited !== wasFavorited) {
          toggleFavorite(event);
        }
      } catch (e) {
        console.warn('toggle favorite error', e);
      }
    },
    [favoritesSet, profile?.id, toggleFavorite]
  );

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
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackToList}
              accessibilityRole="button"
              accessibilityLabel="Retour à la liste"
            >
              <ArrowLeft size={22} color={colors.brand.text} />
            </TouchableOpacity>
            <View style={styles.searchBarWrap}>
              <SearchBar
                onApply={applySearch}
                hasLocation={!!userLocation}
                applied={searchApplied}
                onExpandedChange={setSearchExpanded}
              />
            </View>
            <View ref={filterButtonRef} collapsable={false}>
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setFiltersVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Ouvrir les filtres"
              >
                <SlidersHorizontal size={20} color={colors.brand.text} />
                {filtersActive ? <View style={styles.filterActiveDot} /> : null}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View
          style={styles.contentColumn}
          onLayout={(event) => handleColumnLayout(event.nativeEvent.layout.height)}
        >
          <Animated.View style={[styles.mapSlot, mapSlotStyle]}>
            <MapWrapper
              ref={mapRef}
              initialRegion={mapCenter}
              userLocation={userLocation}
              onFeaturePress={handleFeaturePress}
              onZoomChange={setZoom}
              styleURL={mapStyle}
              mapPadding={mapPadding}
              onVisibleBoundsChange={handleBoundsChange}
              onMapReady={handleMapReady}
              onMapBackgroundPress={handleMapBackgroundPress}
              activeEventId={activeEventId}
            />

            {userLocation && !searchExpanded && (
              <TouchableOpacity
                style={[styles.recenterTopButton, { bottom: spacing.md }]}
                onPress={recenterToUser}
              >
                <Navigation size={18} color={colors.neutral[0]} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.createFab, { bottom: spacing.md + 56 }]}
              onPress={handleCreateEvent}
              accessibilityRole="button"
              accessibilityLabel="Créer un événement"
            >
              <PlusCircle size={28} color="#0f1719" />
            </TouchableOpacity>

            {unitCardEvent ? (
              <MapEventUnitOverlay
                event={unitCardEvent}
                visible={!!unitCardEvent}
                isFavorite={favoritesSet.has(unitCardEvent.id)}
                onToggleFavorite={() => handleToggleFavorite(unitCardEvent)}
                onPress={() => router.push(`/events/${unitCardEvent.id}` as any)}
                onClose={() => {
                  setUnitCardEvent(null);
                  viewportFrozenRef.current = false;
                  closeSheet();
                }}
                bottomInset={spacing.sm}
              />
            ) : null}
          </Animated.View>

          <View style={styles.sheetSlot}>
            <SearchResultsBottomSheet
              ref={resultsSheetRef}
              events={sheetEvents}
              currentUserId={profile?.id}
              activeEventId={activeEventId}
              snapHeights={snapHeights}
              isSheetDragging={isSheetDragging}
              onSheetDragStart={beginSheetDrag}
              onSheetDragMove={updateSheetDrag}
              onSheetDragEnd={handleSheetDragEnd}
              onSelectEvent={(event) => selectSingleEvent(event, bottomSheetIndex)}
              onHighlightEvent={handleHighlightEvent}
              onNavigate={(event) => setNavEvent(event)}
              onOpenDetails={(event) => router.push(`/events/${event.id}` as any)}
              onOpenCreator={(creatorId) => router.push(`/community/${creatorId}` as any)}
              onToggleLike={handleToggleLike}
              isLiked={(id) => likesSet.has(id)}
              onToggleFavorite={handleToggleFavorite}
              isFavorite={(id) => favoritesSet.has(id)}
              snapIndex={bottomSheetIndex}
              onSnapIndexChange={handleSheetIndexChange}
              mode={sheetStatus === 'singleEvent' ? 'single' : 'viewport'}
              peekCount={sheetStatus === 'singleEvent' ? 0 : visibleEventCount}
              metaFilter={metaFilter}
              isLoading={sheetStatus === 'loading'}
            />
          </View>
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
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortByChange={(value) => searchState.setSortBy(value)}
        onSortOrderChange={(order) => searchState.setSortOrder(order)}
        hasLocation={!!userLocation}
      />

      <NavigationOptionsSheet
        visible={!!navEvent}
        event={navEvent}
        onClose={() => setNavEvent(null)}
      />

      <GuestGateModal
        visible={guestGateVisible}
        title="Créer un événement"
        onClose={() => setGuestGateVisible(false)}
        onSignUp={() => {
          setGuestGateVisible(false);
          router.push('/auth/register' as any);
        }}
        onSignIn={() => {
          setGuestGateVisible(false);
          router.push('/auth/login' as any);
        }}
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
    backgroundColor: colors.brand.primary,
  },
  searchSlot: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.brand.primary,
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
    flexDirection: 'column',
    backgroundColor: colors.brand.primary,
  },
  mapSlot: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.brand.primary,
    borderBottomLeftRadius: SHEET_JUNCTION_RADIUS,
    borderBottomRightRadius: SHEET_JUNCTION_RADIUS,
  },
  sheetSlot: {
    flex: 1,
    width: '100%',
    minHeight: VIEWPORT_PEEK_HEIGHT,
    overflow: 'hidden',
    backgroundColor: colors.brand.primary,
    borderTopLeftRadius: SHEET_JUNCTION_RADIUS,
    borderTopRightRadius: SHEET_JUNCTION_RADIUS,
    marginTop: -SHEET_JUNCTION_RADIUS,
    paddingTop: SHEET_JUNCTION_RADIUS,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  createFab: {
    position: 'absolute',
    right: spacing.md,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 11,
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 6,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    gap: spacing.sm,
  },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  fallbackText: {
    marginTop: spacing.md,
    textAlign: 'center',
    color: colors.brand.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  fallbackSubtext: {
    marginTop: spacing.sm,
    textAlign: 'center',
    color: colors.brand.textSecondary,
    fontSize: 14,
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
