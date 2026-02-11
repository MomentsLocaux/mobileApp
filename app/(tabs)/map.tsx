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
import { useLocation } from '../../src/hooks';
import { useLocationStore, useSearchStore, useMapResultsUIStore } from '../../src/store';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useAuth } from '@/hooks';
import { buildFiltersFromSearch } from '../../src/utils/search-filters';
import { filterEvents, filterEventsByMetaStatus, type EventMetaFilter } from '../../src/utils/filter-events';
import { sortEvents } from '../../src/utils/sort-events';
import { colors, spacing, borderRadius, typography } from '../../src/constants/theme';
import { SearchBar } from '../../src/components/search/SearchBar';
import { SearchResultsBottomSheet, type SearchResultsBottomSheetHandle } from '../../src/components/search/SearchResultsBottomSheet';
import { NavigationOptionsSheet } from '../../src/components/search/NavigationOptionsSheet';
import type { EventWithCreator } from '../../src/types/database';

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
  const [searchApplied, setSearchApplied] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [metaFilter, setMetaFilter] = useState<EventMetaFilter>('all');
  const useSearchRadiusBoundsRef = useRef(false);
  const initialViewportBootstrapDoneRef = useRef(false);

  const getPaddingFromIndex = useCallback((idx: number) => {
    return idx === 2 ? 360 : idx === 1 ? 240 : 120;
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
        return { top: 20, right: 20, bottom: 360, left: 20 };
      case 'medium':
        return { top: 20, right: 20, bottom: 240, left: 20 };
      default:
        return { top: 20, right: 20, bottom: 120, left: 20 };
    }
  }, [mapPaddingLevel]);

  const getFitPadding = useCallback(() => {
    const base = mapPadding?.bottom ?? 0;
    if (base <= 0) return 20;
    return Math.min(40, base);
  }, [mapPadding]);

  const hasSearchCriteria = useMemo(() => {
    const hasWhere = !!searchState.where.location || !!searchState.where.radiusKm;
    const hasWhen =
      !!searchState.when.preset ||
      !!searchState.when.startDate ||
      !!searchState.when.endDate ||
      !!searchState.when.includePast;
    const hasWhat =
      searchState.what.categories.length > 0 ||
      searchState.what.subcategories.length > 0 ||
      searchState.what.tags.length > 0 ||
      !!searchState.what.query?.trim();
    return hasWhere || hasWhen || hasWhat;
  }, [searchState]);

  const searchActive = metaFilter === 'all' && searchApplied && hasSearchCriteria;
  const searchFilters = useMemo(() => buildFiltersFromSearch(searchState, userLocation), [searchState, userLocation]);
  const searchFiltersWithoutRadius = useMemo(() => {
    const { radiusKm, centerLat, centerLon, ...rest } = searchFilters;
    return rest;
  }, [searchFilters]);
  const sortBy = searchState.sortBy || 'triage';
  const sortOrder = searchState.sortOrder;
  const sortCenter = useMemo(
    () =>
      searchState.where.location
        ? { latitude: searchState.where.location.latitude, longitude: searchState.where.location.longitude }
        : userLocation,
    [searchState.where.location, userLocation]
  );

  // À chaque retour sur l’onglet carte, on repart en mode peek.
  useFocusEffect(
    useCallback(() => {
      setBottomSheetIndex(0);
      hideBottomBar();
      setStatus('browsing');
    }, [hideBottomBar, setBottomSheetIndex, setStatus])
  );

  const handleBoundsChange = useCallback(
    (bounds: { ne: [number, number]; sw: [number, number] }, options?: { forceSearchRadius?: boolean }) => {
      if (isProgrammaticMoveRef.current && !options?.forceSearchRadius) return;
      if (bboxTimeoutRef.current) clearTimeout(bboxTimeoutRef.current);
      const requestId = ++viewportRequestIdRef.current;

      setStatus('browsing');
      if (searchActive && !options?.forceSearchRadius) {
        useSearchRadiusBoundsRef.current = false;
      }

      bboxTimeoutRef.current = setTimeout(async () => {
        if (requestId !== viewportRequestIdRef.current) return;
        setStatus('loading');
        try {
          const effectiveSearchActive = metaFilter === 'all' && searchApplied && hasSearchCriteria;
          const includePastForFetch = metaFilter === 'past' ? true : effectiveSearchActive ? includePast : false;
          const useRadiusBounds = effectiveSearchActive && useSearchRadiusBoundsRef.current;
          const effectiveFilters = useRadiusBounds ? searchFilters : searchFiltersWithoutRadius;

          const featureCollection = await EventsService.listEventsByBBox({
            ne: bounds.ne,
            sw: bounds.sw,
            limit: 300,
            includePast: includePastForFetch,
          });

          const ids = featureCollection?.features?.map((f: any) => f?.properties?.id).filter(Boolean) || [];
          const uniqueIds = Array.from(new Set(ids)) as string[];
          const limitedIds = uniqueIds.slice(0, 120);
          const events = limitedIds.length ? await EventsService.getEventsByIds(limitedIds) : [];

          const filteredEvents = effectiveSearchActive ? filterEvents(events, effectiveFilters, null) : events;
          const metaFilteredEvents = filterEventsByMetaStatus(filteredEvents, metaFilter);
          const sortedEvents = effectiveSearchActive
            ? sortEvents(metaFilteredEvents, sortBy, sortCenter, sortOrder)
            : metaFilteredEvents;

          const filteredIds = new Set(sortedEvents.map((e) => e.id));
          const filteredFeatures = (featureCollection?.features || []).filter((f: any) =>
            filteredIds.has(f?.properties?.id)
          );

          if (requestId !== viewportRequestIdRef.current) return;
          mapRef.current?.setShape({ type: 'FeatureCollection', features: filteredFeatures } as any);
          const currentUiState = useMapResultsUIStore.getState();
          if (currentUiState.sheetStatus === 'singleEvent') return;
          displayViewportResults(sortedEvents);
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
      searchFiltersWithoutRadius,
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
        isProgrammaticMoveRef.current = false;
        handleBoundsChange(bounds, { forceSearchRadius: true });
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

  const withProgrammaticMove = useCallback((moveFn: () => void, duration = 450) => {
    isProgrammaticMoveRef.current = true;
    moveFn();
    setTimeout(() => {
      isProgrammaticMoveRef.current = false;
    }, duration);
  }, []);

  const getBoundsFromRadius = useCallback((latitude: number, longitude: number, radiusKm: number) => {
    const latDelta = radiusKm / 111;
    const lonDelta = radiusKm / (111 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.1));
    return {
      ne: [longitude + lonDelta, latitude + latDelta] as [number, number],
      sw: [longitude - lonDelta, latitude - latDelta] as [number, number],
    };
  }, []);

  const fitToRadius = useCallback(
    (latitude: number, longitude: number, radiusKm: number) => {
      const bounds = getBoundsFromRadius(latitude, longitude, radiusKm);
      const coords = [
        { latitude: bounds.sw[1], longitude: bounds.sw[0] },
        { latitude: bounds.ne[1], longitude: bounds.ne[0] },
      ];
      const fitPadding = getFitPadding();
      withProgrammaticMove(() => mapRef.current?.fitToCoordinates(coords, fitPadding));
      return bounds;
    },
    [getBoundsFromRadius, getFitPadding, withProgrammaticMove]
  );

  const applySearch = useCallback(() => {
    setMetaFilter('all');
    setSearchApplied(true);
    setStatus('loading');
    const location = searchState.where.location;
    const selectedRadius = searchState.where.radiusKm;
    const effectiveRadius = selectedRadius && selectedRadius > 0 ? selectedRadius : 10;
    
    const moveAction = () => {
      if (location) {
        useSearchRadiusBoundsRef.current = true;
        return fitToRadius(location.latitude, location.longitude, effectiveRadius);
      }
      if (searchState.where.radiusKm && userLocation) {
        useSearchRadiusBoundsRef.current = true;
        return fitToRadius(userLocation.latitude, userLocation.longitude, effectiveRadius);
      }
      useSearchRadiusBoundsRef.current = false;
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
    
  }, [fitToRadius, refreshBounds, searchState.where, userLocation, setStatus, withProgrammaticMove, handleBoundsChange]);

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
    if (userLocation && !hasCenteredOnUserRef.current) {
      recenterToUser();
      hasCenteredOnUserRef.current = true;
    }
  }, [recenterToUser, userLocation]);

  useEffect(() => {
    if (!hasSearchCriteria && searchApplied) {
      setSearchApplied(false);
      useSearchRadiusBoundsRef.current = false;
      refreshBounds();
    }
  }, [hasSearchCriteria, searchApplied, refreshBounds]);

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

  const handleToggleFavorite = useCallback(
    async (event: EventWithCreator) => {
      try {
        await SocialService.toggleFavorite(profile?.id || '', event.id);
        toggleFavorite(event);
      } catch (e) {
        console.warn('toggle favorite error', e);
      }
    },
    [profile?.id, toggleFavorite]
  );

  const focusOnBounds = useCallback(
    (bounds: { ne: [number, number]; sw: [number, number] } | null, snapIndex: number) => {
      if (!bounds || !bounds.ne || !bounds.sw) return;
      const paddingBottom = getPaddingFromIndex(snapIndex);
      const coords = [
        { longitude: bounds.sw[0], latitude: bounds.sw[1] },
        { longitude: bounds.ne[0], latitude: bounds.ne[1] },
      ];
      withProgrammaticMove(() => mapRef.current?.fitToCoordinates(coords, paddingBottom));
    },
    [getPaddingFromIndex, withProgrammaticMove]
  );
  
  if (locationLoading && !userLocation) {
    return (
      <GestureHandlerRootView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.fallbackText}>Obtention de votre position...</Text>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
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
                    useSearchRadiusBoundsRef.current = false;
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
        activeEventId={activeEventId}
        onSelectEvent={(event) => selectSingleEvent(event, bottomSheetIndex)}
        onNavigate={(event) => setNavEvent(event)}
        onOpenDetails={(event) => router.push(`/events/${event.id}` as any)}
        onOpenCreator={(creatorId) => router.push(`/community/${creatorId}` as any)}
        onToggleFavorite={handleToggleFavorite}
        isFavorite={(id) => favoritesSet.has(id)}
        onIndexChange={(idx) => {
          if (idx < 0) return;
          setBottomSheetIndex(idx);
          const paddingLevel = idx === 2 ? 'high' : idx === 1 ? 'medium' : 'low';
          updateMapPadding(paddingLevel);
          
          if (idx <= 0) {
            hideBottomBar();
            closeSheet();
          } else {
            showBottomBar();
          }

          if (idx === 1 && sheetStatus === 'viewportResults') {
            mapRef.current?.getVisibleBounds?.().then((bounds) => {
              if (bounds) focusOnBounds(bounds, idx);
            });
          }
           if (idx > 0 && sheetStatus === 'singleEvent' && sheetEvents.length > 0) {
            focusOnEvent(sheetEvents[0], idx);
          }
        }}
        mode={sheetStatus === 'singleEvent' ? 'single' : 'viewport'}
        peekCount={sheetStatus === 'singleEvent' ? 0 : visibleEventCount}
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
    backgroundColor: colors.neutral[100],
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[100],
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
    color: colors.neutral[600],
    fontSize: 16,
    fontWeight: '600',
  },
  fallbackSubtext: {
    marginTop: spacing.sm,
    textAlign: 'center',
    color: colors.neutral[500],
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
  metaFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  metaFilterPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  metaFilterPillActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[300],
  },
  metaFilterText: {
    ...typography.caption,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  metaFilterTextActive: {
    color: colors.primary[700],
  },
  recenterTopButton: {
    position: 'absolute',
    right: spacing.md,
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[600],
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
    backgroundColor: colors.neutral[0],
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  layerButtonActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
    borderWidth: 1,
  },
  layerButtonText: {
    color: colors.neutral[700],
    fontWeight: '600',
    fontSize: 12,
  },
  layerButtonTextActive: {
    color: colors.primary[700],
  },
});
