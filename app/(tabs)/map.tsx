import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Navigation } from 'lucide-react-native';
import Mapbox from '@rnmapbox/maps';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapWrapper, type MapWrapperHandle } from '../../src/components/map';
import type { MapBoundsMeta } from '../../src/components/map/MapWrapper';
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
import { SearchResultsBottomSheet, type SearchResultsBottomSheetHandle } from '../../src/components/search/SearchResultsBottomSheet';
import { NavigationOptionsSheet } from '../../src/components/search/NavigationOptionsSheet';
import type { EventWithCreator } from '../../src/types/database';
import { AppBackground } from '../../src/components/ui';

const FONTOY_COORDS = { latitude: 49.3247, longitude: 5.9947 };
const SIM_FALLBACK_COORDS = { latitude: 37.785834, longitude: -122.406417 };
const TAB_BAR_HEIGHT = 76;
const MAP_CAMERA_PADDING = { top: 20, right: 20, bottom: 120, left: 20 };
const SINGLE_EVENT_CAMERA_PADDING_BOTTOM = 280;
const BBOX_DEBOUNCE_MS = 400;

export default function MapScreen() {
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  useLocation();
  const { currentLocation, isLoading: locationLoading } = useLocationStore();
  const searchState = useSearchStore();
  const { profile } = useAuth();
  const { favorites, toggleFavorite } = useFavoritesStore();
  const { likedEventIds, toggleLike } = useLikesStore();
  const {
    bottomSheetIndex,
    setBottomSheetIndex,
    sheetMode,
    sheetEvents,
    visibleEventCount,
    activeEventId,
    isViewportFetching,
    setViewportFetching,
    setViewportResults,
    enterSingleEvent,
    exitSingleEvent,
  } = useMapResultsUIStore();
  const insets = useSafeAreaInsets();

  const [navEvent, setNavEvent] = useState<any | null>(null);
  const [zoom, setZoom] = useState(12);
  const hasCenteredOnUserRef = useRef(false);
  const mapRef = useRef<MapWrapperHandle>(null);
  const resultsSheetRef = useRef<SearchResultsBottomSheetHandle>(null);
  const [mapMode, setMapMode] = useState<'standard' | 'satellite'>('standard');
  const includePast = !!searchState.when.includePast;
  const focusHandledRef = useRef(false);
  const bboxTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportRequestIdRef = useRef(0);
  const markerRequestIdRef = useRef(0);
  const eventCacheRef = useRef<Map<string, EventWithCreator>>(new Map());
  const lastFocusedEventIdRef = useRef<string | undefined>(undefined);
  const initialViewportBootstrapDoneRef = useRef(false);
  const searchApplied = searchState.searchApplied;
  const setSearchApplied = searchState.setSearchApplied;
  const commitSearch = searchState.commitSearch;
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [metaFilter, setMetaFilter] = useState<EventMetaFilter>('all');

  const sheetBottomInset = TAB_BAR_HEIGHT + insets.bottom;

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

  const cacheEvents = useCallback((events: EventWithCreator[]) => {
    events.forEach((event) => {
      eventCacheRef.current.set(event.id, event);
    });
  }, []);

  const fetchViewportForBounds = useCallback(
    async (
      bounds: { ne: [number, number]; sw: [number, number] },
      requestId: number
    ) => {
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
        : metaFilter === 'past' || metaFilter === 'upcoming'
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

      mapRef.current?.setShape({ type: 'FeatureCollection', features: filteredFeatures } as any);
      cacheEvents(dedupedEvents);

      const currentState = useMapResultsUIStore.getState();
      if (currentState.sheetMode === 'singleEvent') return;

      setViewportResults(dedupedEvents);
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
      cacheEvents,
      setViewportResults,
    ]
  );

  const handleBoundsChange = useCallback(
    (
      bounds: { ne: [number, number]; sw: [number, number] },
      meta: MapBoundsMeta,
      options?: { force?: boolean }
    ) => {
      if (meta.source === 'programmatic' && !options?.force) return;

      if (meta.source === 'user') {
        exitSingleEvent();
      }

      if (bboxTimeoutRef.current) clearTimeout(bboxTimeoutRef.current);
      const requestId = ++viewportRequestIdRef.current;
      setViewportFetching(true);

      bboxTimeoutRef.current = setTimeout(async () => {
        if (requestId !== viewportRequestIdRef.current) return;
        try {
          await fetchViewportForBounds(bounds, requestId);
        } catch (e) {
          if (requestId !== viewportRequestIdRef.current) return;
          console.warn('bbox fetch error', e);
          setViewportFetching(false);
        }
      }, BBOX_DEBOUNCE_MS);
    },
    [exitSingleEvent, fetchViewportForBounds, setViewportFetching]
  );

  const refreshBounds = useCallback(
    async (options?: { force?: boolean }) => {
      const bounds = await mapRef.current?.getVisibleBounds?.();
      if (bounds) {
        handleBoundsChange(bounds, { source: 'programmatic' }, { force: true });
      }
    },
    [handleBoundsChange]
  );

  useFocusEffect(
    useCallback(() => {
      if (searchApplied && hasSearchCriteria) {
        refreshBounds({ force: true });
      }
    }, [hasSearchCriteria, refreshBounds, searchApplied])
  );

  useEffect(() => {
    if (locationLoading || initialViewportBootstrapDoneRef.current) return;

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      if (cancelled || initialViewportBootstrapDoneRef.current) return;

      const bounds = await mapRef.current?.getVisibleBounds?.();
      if (cancelled || initialViewportBootstrapDoneRef.current) return;

      if (bounds) {
        initialViewportBootstrapDoneRef.current = true;
        handleBoundsChange(bounds, { source: 'programmatic' }, { force: true });
        return;
      }

      attempts += 1;
      if (attempts < 8) {
        timer = setTimeout(run, 350);
      }
    };

    timer = setTimeout(run, userLocation ? 700 : 250);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [handleBoundsChange, locationLoading, userLocation]);

  const fitToRadius = useCallback((latitude: number, longitude: number, radiusKm: number) => {
    const bounds = getBoundsFromRadiusKm(latitude, longitude, radiusKm);
    const coords = [
      { latitude: bounds.sw[1], longitude: bounds.sw[0] },
      { latitude: bounds.ne[1], longitude: bounds.ne[0] },
    ];
    mapRef.current?.fitToCoordinates(coords, 40);
    return bounds;
  }, []);

  const applySearch = useCallback(() => {
    setMetaFilter('all');
    commitSearch();
    setViewportFetching(true);

    const location = searchState.where.location;
    const effectiveRadius = resolveEffectiveRadiusKm(searchState.where, userLocation) ?? 10;

    const bounds = (() => {
      if (location) {
        return fitToRadius(location.latitude, location.longitude, effectiveRadius);
      }
      if (searchState.where.radiusKm !== undefined && userLocation) {
        return fitToRadius(userLocation.latitude, userLocation.longitude, effectiveRadius);
      }
      return null;
    })();

    setTimeout(() => {
      if (bounds) {
        handleBoundsChange(bounds, { source: 'programmatic' }, { force: true });
      } else {
        refreshBounds({ force: true });
      }
    }, 500);
  }, [
    commitSearch,
    fitToRadius,
    handleBoundsChange,
    refreshBounds,
    searchState.where,
    setViewportFetching,
    userLocation,
  ]);

  const handleFeaturePress = useCallback(
    async (id: string) => {
      const requestId = ++markerRequestIdRef.current;
      viewportRequestIdRef.current += 1;
      if (bboxTimeoutRef.current) {
        clearTimeout(bboxTimeoutRef.current);
        bboxTimeoutRef.current = null;
      }
      setViewportFetching(false);

      try {
        const evt = eventCacheRef.current.has(id)
          ? eventCacheRef.current.get(id)!
          : await EventsService.getEventById(id);

        if (requestId !== markerRequestIdRef.current) return;
        if (!evt) return;

        eventCacheRef.current.set(id, evt);
        enterSingleEvent(evt, 1);
      } catch (e) {
        if (requestId !== markerRequestIdRef.current) return;
        console.warn('getEventById error', e);
      }
    },
    [enterSingleEvent, setViewportFetching]
  );

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
    if (sheetMode !== 'singleEvent' || !activeEventId || sheetEvents.length === 0) {
      if (sheetMode !== 'singleEvent') {
        lastFocusedEventIdRef.current = undefined;
      }
      return;
    }
    if (lastFocusedEventIdRef.current === activeEventId) return;
    lastFocusedEventIdRef.current = activeEventId;

    const event = sheetEvents[0];
    const targetIndex = bottomSheetIndex > 0 ? bottomSheetIndex : 1;
    if (bottomSheetIndex === 0) {
      setBottomSheetIndex(targetIndex);
    }

    if (typeof event.longitude === 'number' && typeof event.latitude === 'number') {
      mapRef.current?.focusOnCoordinate({
        longitude: event.longitude,
        latitude: event.latitude,
        zoom: Math.max(zoom, 14),
        paddingBottom: SINGLE_EVENT_CAMERA_PADDING_BOTTOM,
      });
    }

    resultsSheetRef.current?.open?.(targetIndex);
  }, [sheetMode, activeEventId, bottomSheetIndex, sheetEvents, setBottomSheetIndex, zoom]);

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
    if (userLocation && !hasCenteredOnUserRef.current) {
      recenterToUser();
      hasCenteredOnUserRef.current = true;
    }
  }, [recenterToUser, userLocation]);

  useEffect(() => {
    if (!hasSearchCriteria && searchApplied) {
      setSearchApplied(false);
      refreshBounds({ force: true });
    }
  }, [hasSearchCriteria, searchApplied, refreshBounds, setSearchApplied]);

  useEffect(() => {
    if (!initialViewportBootstrapDoneRef.current) return;
    refreshBounds({ force: true });
  }, [metaFilter, sortBy, sortOrder, refreshBounds]);

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
      <MapWrapper
        ref={mapRef}
        initialRegion={mapCenter}
        userLocation={userLocation}
        onFeaturePress={handleFeaturePress}
        onZoomChange={setZoom}
        styleURL={mapStyle}
        mapPadding={MAP_CAMERA_PADDING}
        onVisibleBoundsChange={handleBoundsChange}
      />

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
              <Text style={[styles.layerButtonText, mapMode === mode && styles.layerButtonTextActive]}>
                {mode === 'standard' ? 'Standard' : 'Satellite'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {userLocation && !searchExpanded && (
        <TouchableOpacity
          style={[styles.recenterTopButton, { bottom: sheetBottomInset + spacing.md }]}
          onPress={recenterToUser}
        >
          <Navigation size={18} color={colors.neutral[0]} />
        </TouchableOpacity>
      )}

      <SearchResultsBottomSheet
        ref={resultsSheetRef}
        events={sheetEvents}
        currentUserId={profile?.id}
        activeEventId={activeEventId}
        onSelectEvent={(event) => enterSingleEvent(event, bottomSheetIndex > 0 ? bottomSheetIndex : 1)}
        onNavigate={(event) => setNavEvent(event)}
        onOpenDetails={(event) => router.push(`/events/${event.id}` as any)}
        onOpenCreator={(creatorId) => router.push(`/community/${creatorId}` as any)}
        onToggleLike={handleToggleLike}
        isLiked={(id) => likesSet.has(id)}
        onToggleFavorite={handleToggleFavorite}
        isFavorite={(id) => favoritesSet.has(id)}
        onIndexChange={(idx) => {
          if (idx < 0) return;
          setBottomSheetIndex(idx);
          if (idx === 0 && sheetMode === 'singleEvent') {
            exitSingleEvent();
          }
        }}
        mode={sheetMode === 'singleEvent' ? 'single' : 'viewport'}
        peekCount={sheetMode === 'singleEvent' ? 0 : visibleEventCount}
        metaFilter={metaFilter}
        index={bottomSheetIndex}
        isRefreshing={isViewportFetching}
        bottomInset={sheetBottomInset}
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
  topOverlay: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    maxWidth: 400,
    zIndex: 10,
    gap: spacing.sm,
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
