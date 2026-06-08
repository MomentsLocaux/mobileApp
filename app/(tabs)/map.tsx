import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Navigation } from 'lucide-react-native';
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
import { SearchResultsBottomSheet, type SearchResultsBottomSheetHandle } from '../../src/components/search/SearchResultsBottomSheet';
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
  const { profile } = useAuth();
  const { favorites, toggleFavorite } = useFavoritesStore();
  const { likedEventIds, toggleLike } = useLikesStore();
  const {
    bottomSheetIndex,
    setBottomSheetIndex,
    bottomBarVisible,
    showBottomBar,
    hideBottomBar,
    updateMapPadding,
    mapPaddingLevel,
    // New state machine from store
    sheetStatus,
    sheetEvents,
    visibleEventCount,
    activeEventId,
    setStatus,
    displayViewportResults,
    selectSingleEvent,
    closeSheet,
  } = useMapResultsUIStore();
  const insets = useSafeAreaInsets();

  const [navEvent, setNavEvent] = useState<any | null>(null);
  const [zoom, setZoom] = useState(12);
  const isProgrammaticMoveRef = useRef(false);
  const hasCenteredOnUserRef = useRef(false);
  const mapRef = useRef<MapWrapperHandle>(null);
  const resultsSheetRef = useRef<SearchResultsBottomSheetHandle>(null);
  const tabTranslate = useSharedValue(0);
  const [mapMode, setMapMode] = useState<'standard' | 'satellite'>('standard');
  const includePast = !!searchState.when.includePast;
  const focusHandledRef = useRef(false);
  const bboxTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportRequestIdRef = useRef(0);
  const markerRequestIdRef = useRef(0);
  const eventCacheRef = useRef<Map<string, EventWithCreator>>(new Map());
  const searchApplied = searchState.searchApplied;
  const setSearchApplied = searchState.setSearchApplied;
  const commitSearch = searchState.commitSearch;
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [metaFilter, setMetaFilter] = useState<EventMetaFilter>('all');
  const initialViewportBootstrapDoneRef = useRef(false);

  const getPaddingFromIndex = useCallback((idx: number) => {
    // Keep camera focus above the bottom sheet: previous values were too low for peek mode.
    return idx === 2 ? 420 : idx === 1 ? 280 : 200;
  }, []);

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

  const mapPadding = useMemo(() => {
    switch (mapPaddingLevel) {
      case 'high':
        return { top: 20, right: 20, bottom: 420, left: 20 };
      case 'medium':
        return { top: 20, right: 20, bottom: 280, left: 20 };
      default:
        return { top: 20, right: 20, bottom: 200, left: 20 };
    }
  }, [mapPaddingLevel]);

  const getFitPadding = useCallback(() => {
    const base = mapPadding?.bottom ?? 0;
    if (base <= 0) return 20;
    return Math.min(40, base);
  }, [mapPadding]);

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

  const handleBoundsChange = useCallback(
    (bounds: { ne: [number, number]; sw: [number, number] }, options?: { forceSearchRadius?: boolean }) => {
      if (isProgrammaticMoveRef.current && !options?.forceSearchRadius) return;
      if (bboxTimeoutRef.current) clearTimeout(bboxTimeoutRef.current);
      const requestId = ++viewportRequestIdRef.current;

      setStatus('browsing');

      bboxTimeoutRef.current = setTimeout(async () => {
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

          const ids = featureCollection?.features?.map((f: any) => f?.properties?.id).filter(Boolean) || [];
          const uniqueIds = Array.from(new Set(ids)) as string[];
          const events = uniqueIds.length ? await EventsService.getEventsByIds(uniqueIds) : [];

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
          setStatus('browsing'); // Reset status on error
        }
      }, 400); // Increased debounce
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
      searchActive,
    ]
  );

  const refreshBounds = useCallback(async () => {
    const bounds = await mapRef.current?.getVisibleBounds?.();
    if (bounds) {
      isProgrammaticMoveRef.current = false; // Ensure we can refresh
      handleBoundsChange(bounds);
    }
  }, [handleBoundsChange]);

  useFocusEffect(
    useCallback(() => {
      if (!searchApplied || !hasSearchCriteria) {
        setBottomSheetIndex(0);
        hideBottomBar();
        setStatus('browsing');
      }
      if (searchApplied && hasSearchCriteria) {
        refreshBounds();
        return;
      }
      const { visibleEventCount: count, sheetStatus } = useMapResultsUIStore.getState();
      if (count === 0 && sheetStatus !== 'singleEvent') {
        isProgrammaticMoveRef.current = false;
        void (async () => {
          const bounds = await mapRef.current?.getVisibleBounds?.();
          if (bounds) {
            handleBoundsChange(bounds, { forceSearchRadius: true });
          }
        })();
      }
    }, [
      hasSearchCriteria,
      hideBottomBar,
      handleBoundsChange,
      refreshBounds,
      searchApplied,
      setBottomSheetIndex,
      setStatus,
    ])
  );

  const loadViewportAfterCameraSettles = useCallback(
    async (delayMs = 750) => {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      isProgrammaticMoveRef.current = false;
      const bounds = await mapRef.current?.getVisibleBounds?.();
      if (!bounds || initialViewportBootstrapDoneRef.current) return;
      initialViewportBootstrapDoneRef.current = true;
      handleBoundsChange(bounds, { forceSearchRadius: true });
    },
    [handleBoundsChange]
  );

  // Fallback zone (Fontoy) when no user GPS — load once map is ready.
  useEffect(() => {
    if (locationLoading || userLocation || initialViewportBootstrapDoneRef.current) return;

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      if (cancelled || initialViewportBootstrapDoneRef.current) return;

      const bounds = await mapRef.current?.getVisibleBounds?.();
      if (cancelled || initialViewportBootstrapDoneRef.current) return;

      if (bounds) {
        initialViewportBootstrapDoneRef.current = true;
        isProgrammaticMoveRef.current = false;
        handleBoundsChange(bounds, { forceSearchRadius: true });
        return;
      }

      attempts += 1;
      if (attempts < 8) {
        timer = setTimeout(run, 350);
      }
    };

    timer = setTimeout(run, 400);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [handleBoundsChange, locationLoading, userLocation]);

  const withProgrammaticMove = useCallback((moveFn: () => void, duration = 450) => {
    isProgrammaticMoveRef.current = true;
    moveFn();
    setTimeout(() => {
      isProgrammaticMoveRef.current = false;
    }, duration);
  }, []);

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

    withProgrammaticMove(() => {
      const bounds = moveAction();
      setTimeout(() => {
        if (bounds) {
          isProgrammaticMoveRef.current = false;
          handleBoundsChange(bounds, { forceSearchRadius: true });
        } else {
          refreshBounds();
        }
      }, 650); // After map move settles
    }, 600);

  }, [commitSearch, fitToRadius, refreshBounds, searchState.where, userLocation, setStatus, withProgrammaticMove, handleBoundsChange]);

  const handleFeaturePress = useCallback(
    async (id: string) => {
      const requestId = ++markerRequestIdRef.current;
      viewportRequestIdRef.current += 1;
      if (bboxTimeoutRef.current) {
        clearTimeout(bboxTimeoutRef.current);
        bboxTimeoutRef.current = null;
      }
      setStatus('loading');
      try {
        const evt = eventCacheRef.current.has(id)
          ? eventCacheRef.current.get(id)!
          : await EventsService.getEventById(id);

        if (requestId !== markerRequestIdRef.current) return;
        if (evt) {
          if (!eventCacheRef.current.has(id)) {
            eventCacheRef.current.set(id, evt);
          }
          selectSingleEvent(evt, 1);
        } else {
          setStatus('browsing');
        }
      } catch (e) {
        if (requestId !== markerRequestIdRef.current) return;
        console.warn('getEventById error', e);
        setStatus('browsing');
      }
    },
    [selectSingleEvent, setStatus]
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

  const focusOnEvent = useCallback(
    (event: EventWithCreator, snapIndex: number) => {
      if (!event || typeof event.longitude !== 'number' || typeof event.latitude !== 'number') return;
      const paddingBottom = getPaddingFromIndex(snapIndex);
      const targetZoom = Math.max(zoom, 14); // Zoom in closer
      withProgrammaticMove(() => {
        mapRef.current?.focusOnCoordinate({
          longitude: event.longitude,
          latitude: event.latitude,
          zoom: targetZoom,
          paddingBottom,
        });
      });
    },
    [getPaddingFromIndex, zoom, withProgrammaticMove]
  );

  // Effect to handle side-effects of state changes
  useEffect(() => {
    if (sheetStatus === 'singleEvent' && sheetEvents.length > 0) {
      const targetIndex = bottomSheetIndex > 0 ? bottomSheetIndex : 1;
      if (bottomSheetIndex === 0) {
        setBottomSheetIndex(targetIndex);
      }
      focusOnEvent(sheetEvents[0], targetIndex);
      resultsSheetRef.current?.open?.(targetIndex);
    }
  }, [sheetStatus, activeEventId, focusOnEvent, bottomSheetIndex, sheetEvents, setBottomSheetIndex]); // Re-run when activeEventId changes

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
    if (!userLocation || hasCenteredOnUserRef.current) return;
    hasCenteredOnUserRef.current = true;
    recenterToUser();
    void loadViewportAfterCameraSettles(800);
  }, [loadViewportAfterCameraSettles, recenterToUser, userLocation]);

  useEffect(() => {
    if (!hasSearchCriteria && searchApplied) {
      setSearchApplied(false);
      refreshBounds();
    }
  }, [hasSearchCriteria, searchApplied, refreshBounds, setSearchApplied]);

  useEffect(() => {
    tabTranslate.value = withTiming(bottomBarVisible ? 0 : 80, { duration: 220 });
  }, [bottomBarVisible, tabTranslate]);

  const tabAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: tabTranslate.value }],
  }));

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
        mapPadding={mapPadding}
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
              <Text style={[styles.layerButtonText, mapMode === mode && styles.layerButtonTextActive]}>
                {mode === 'standard' ? 'Standard' : 'Satellite'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {userLocation && !searchExpanded && (
        <TouchableOpacity
          style={[styles.recenterTopButton, { bottom: insets.bottom + 16 }]}
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
        onSelectEvent={(event) => selectSingleEvent(event, bottomSheetIndex)}
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
          // UX: opening/expanding viewport sheet must not shift map/bbox.
          // Keep map padding stable in viewport mode; only adapt in single-event focus mode.
          if (idx <= 0) {
            updateMapPadding('low');
          } else if (sheetStatus === 'singleEvent') {
            const paddingLevel = idx === 2 ? 'high' : 'medium';
            updateMapPadding(paddingLevel);
          } else {
            updateMapPadding('low');
          }

          if (idx <= 0) {
            hideBottomBar();
            closeSheet();
          } else {
            showBottomBar();
          }

          if (idx > 0 && sheetStatus === 'singleEvent' && sheetEvents.length > 0) {
            focusOnEvent(sheetEvents[0], idx);
          }
        }}
        mode={sheetStatus === 'singleEvent' ? 'single' : 'viewport'}
        peekCount={sheetStatus === 'singleEvent' ? 0 : visibleEventCount}
        metaFilter={metaFilter}
        index={bottomSheetIndex}
        isLoading={sheetStatus === 'loading'}
      />

      <NavigationOptionsSheet
        visible={!!navEvent}
        event={navEvent}
        onClose={() => setNavEvent(null)}
      />

      <Animated.View style={[styles.tabSpacer, tabAnimatedStyle]} />
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
  tabSpacer: {
    height: spacing.lg,
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
