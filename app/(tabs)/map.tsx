import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { VIEWPORT_PEEK_HEIGHT } from '../../src/utils/map-sheet-layout';
import { useMapSheetSplitLayout } from '@/hooks/useMapSheetSplitLayout';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Navigation, PlusCircle } from 'lucide-react-native';
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
import { TriageControl } from '../../src/components/search/TriageControl';
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
  const { layoutHeight, mapSlotHeight, handleColumnLayout, setSheetSnapIndex } =
    useMapSheetSplitLayout(sheetMode);

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
  const [mapMode, setMapMode] = useState<'standard' | 'satellite'>('standard');
  const includePast = !!searchState.when.includePast;
  const focusHandledRef = useRef(false);
  const bboxTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportRequestIdRef = useRef(0);
  const markerRequestIdRef = useRef(0);
  const viewportFrozenRef = useRef(false);
  const pendingProgrammaticRefreshRef = useRef(false);
  const pendingCarouselScrollIdRef = useRef<string | null>(null);
  const eventCacheRef = useRef<Map<string, EventWithCreator>>(new Map());
  const searchApplied = searchState.searchApplied;
  const setSearchApplied = searchState.setSearchApplied;
  const commitSearch = searchState.commitSearch;
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [guestGateVisible, setGuestGateVisible] = useState(false);
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

        const currentStatus = useMapResultsUIStore.getState().sheetStatus;
        if (currentStatus === 'singleEvent') {
          selectSingleEvent(evt, 1);
          return;
        }

        highlightViewportEvent(evt);
        viewportFrozenRef.current = true;
        pendingCarouselScrollIdRef.current = id;
        resultsSheetRef.current?.open(1);
        focusOnEvent(evt, 1, { bumpZoom: false });
      } catch (e) {
        if (requestId !== markerRequestIdRef.current) return;
        console.warn('getEventById error', e);
      }
    },
    [focusOnEvent, highlightViewportEvent, selectSingleEvent, sheetEvents]
  );

  const handleMapBackgroundPress = useCallback(() => {
    viewportFrozenRef.current = false;
    pendingCarouselScrollIdRef.current = null;
    resultsSheetRef.current?.collapseToPeek();
  }, []);

  const handleSheetIndexChange = useCallback(
    (idx: number) => {
      if (idx < 0) return;
      setBottomSheetIndex(idx);
      setSheetSnapIndex(idx);

      if (idx === 0) {
        viewportFrozenRef.current = false;
        closeSheet();
      }

      if (idx > 0 && sheetStatus === 'singleEvent' && sheetEvents.length > 0) {
        focusOnEvent(sheetEvents[0], idx, { bumpZoom: false });
      }

      const scrollId =
        pendingCarouselScrollIdRef.current ?? (idx >= 1 ? activeEventId : undefined);
      if (idx >= 1 && scrollId) {
        pendingCarouselScrollIdRef.current = null;
        resultsSheetRef.current?.scrollToEvent(scrollId);
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

  const handleBackToList = useCallback(() => {
    router.push('/(tabs)/' as any);
  }, [router]);

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
      <View
        style={styles.screenColumn}
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

          <TouchableOpacity
            style={[styles.backButton, { top: insets.top + spacing.xs }]}
            onPress={handleBackToList}
            accessibilityRole="button"
            accessibilityLabel="Retour à la liste"
          >
            <ArrowLeft size={22} color="#222222" />
          </TouchableOpacity>

          <View style={[styles.topOverlay, { top: insets.top + spacing.xs }]}>
            <SearchBar
              onApply={applySearch}
              hasLocation={!!userLocation}
              applied={searchApplied}
              onExpandedChange={setSearchExpanded}
            />
            <View style={styles.metaFilterRow}>
              {([
                { key: 'all', label: 'Tous' },
                { key: 'live', label: 'En cours' },
                { key: 'upcoming', label: 'À venir' },
                { key: 'past', label: 'Passés' },
              ] as const).map((item) => {
                const active = metaFilter === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.metaFilterPill, active && styles.metaFilterPillActive]}
                    onPress={() => {
                      setMetaFilter(item.key);
                      if (item.key !== 'all') {
                        setSearchApplied(false);
                      }
                      refreshBounds();
                    }}
                  >
                    <Text style={[styles.metaFilterText, active && styles.metaFilterTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {searchActive ? (
              <View style={styles.sortRow}>
                <TriageControl
                  value={sortBy}
                  onChange={(value) => searchState.setSortBy(value)}
                  sortOrder={sortOrder}
                  onSortOrderChange={(order) => searchState.setSortOrder(order)}
                  hasLocation={!!userLocation}
                  showLabel={false}
                />
              </View>
            ) : null}
            <View style={styles.layerSwitcher}>
              {(['standard', 'satellite'] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.layerButton, mapMode === mode && styles.layerButtonActive]}
                  onPress={() => setMapMode(mode)}
                >
                  <Text
                    style={[styles.layerButtonText, mapMode === mode && styles.layerButtonTextActive]}
                  >
                    {mode === 'standard' ? 'Standard' : 'Satellite'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

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
        </Animated.View>

        <View style={styles.sheetSlot}>
          <SearchResultsBottomSheet
            ref={resultsSheetRef}
            events={sheetEvents}
            currentUserId={profile?.id}
            activeEventId={activeEventId}
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
  screenColumn: {
    flex: 1,
    flexDirection: 'column',
  },
  mapSlot: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  sheetSlot: {
    flex: 1,
    width: '100%',
    minHeight: VIEWPORT_PEEK_HEIGHT,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  topOverlay: {
    position: 'absolute',
    left: spacing.md + 52,
    right: spacing.md,
    maxWidth: 400,
    zIndex: 10,
    gap: spacing.sm,
  },
  backButton: {
    position: 'absolute',
    left: spacing.md,
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 11,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 4,
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
  sortRow: {
    alignSelf: 'flex-end',
  },
  metaFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  metaFilterPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  metaFilterPillActive: {
    backgroundColor: 'rgba(43, 191, 227, 0.1)',
    borderColor: colors.brand.secondary,
  },
  metaFilterText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
  metaFilterTextActive: {
    color: colors.brand.secondary,
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
  layerSwitcher: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  layerButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  layerButtonActive: {
    backgroundColor: 'rgba(43, 191, 227, 0.1)',
    borderColor: colors.brand.secondary,
    borderWidth: 1,
  },
  layerButtonText: {
    color: colors.brand.textSecondary,
    fontWeight: '600',
    fontSize: 12,
  },
  layerButtonTextActive: {
    color: colors.brand.secondary,
  },
});
