import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, Platform, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MapPin, Navigation } from 'lucide-react-native';
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
import { filterEvents } from '../../src/utils/filter-events';
import { sortEvents } from '../../src/utils/sort-events';
import { colors, spacing, borderRadius } from '../../src/constants/theme';
import { SearchBar } from '../../src/components/search/SearchBar';
import { SearchResultsBottomSheet, type SearchResultsBottomSheetHandle } from '../../src/components/search/SearchResultsBottomSheet';
import { NavigationOptionsSheet } from '../../src/components/search/NavigationOptionsSheet';
import type { EventWithCreator } from '../../src/types/database';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';
const FONTOY_COORDS = { latitude: 49.3247, longitude: 5.9947 };
const SIM_FALLBACK_COORDS = { latitude: 37.785834, longitude: -122.406417 };

export default function MapScreen() {
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  useLocation();
  const { currentLocation, isLoading: locationLoading } = useLocationStore();
  const searchState = useSearchStore();
  const { profile } = useAuth();
  const { favorites, toggleFavorite, isFavorite } = useFavoritesStore();
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
  const bboxTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const eventCacheRef = useRef<Map<string, EventWithCreator>>(new Map());
  const [searchApplied, setSearchApplied] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);

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
      searchState.what.tags.length > 0;
    return hasWhere || hasWhen || hasWhat;
  }, [searchState]);

  const searchActive = searchApplied && hasSearchCriteria;
  const searchFilters = useMemo(() => buildFiltersFromSearch(searchState, userLocation), [searchState, userLocation]);
  const sortBy = searchState.sortBy || 'triage';
  const sortCenter = searchState.where.location
    ? { latitude: searchState.where.location.latitude, longitude: searchState.where.location.longitude }
    : userLocation;

  // À chaque retour sur l’onglet carte, on repart en mode peek.
  useFocusEffect(
    useCallback(() => {
      setBottomSheetIndex(0);
      hideBottomBar();
      setStatus('browsing');
    }, [hideBottomBar, setBottomSheetIndex, setStatus])
  );

  const handleBoundsChange = useCallback(
    (bounds: { ne: [number, number]; sw: [number, number] }) => {
      if (isProgrammaticMoveRef.current) return;
      if (bboxTimeoutRef.current) clearTimeout(bboxTimeoutRef.current);

      setStatus('browsing');

      bboxTimeoutRef.current = setTimeout(async () => {
        setStatus('loading');
        try {
          const effectiveSearchActive = searchApplied && hasSearchCriteria;
          const includePastForFetch = effectiveSearchActive ? includePast : false;

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

          const filteredEvents = effectiveSearchActive ? filterEvents(events, searchFilters, null) : events;
          const sortedEvents = effectiveSearchActive ? sortEvents(filteredEvents, sortBy, sortCenter) : filteredEvents;

          const filteredIds = new Set(sortedEvents.map((e) => e.id));
          const filteredFeatures = (featureCollection?.features || []).filter((f: any) =>
            filteredIds.has(f?.properties?.id)
          );

          mapRef.current?.setShape({ type: 'FeatureCollection', features: filteredFeatures } as any);
          displayViewportResults(sortedEvents);
          resultsSheetRef.current?.open?.(0); // Peek
        } catch (e) {
          console.warn('bbox fetch error', e);
          setStatus('browsing'); // Reset status on error
        }
      }, 400); // Increased debounce
    },
    [
      searchApplied,
      hasSearchCriteria,
      includePast,
      searchFilters,
      sortBy,
      sortCenter,
      setStatus,
      displayViewportResults,
    ]
  );

  const refreshBounds = useCallback(async () => {
    const bounds = await mapRef.current?.getVisibleBounds?.();
    if (bounds) {
      isProgrammaticMoveRef.current = false; // Ensure we can refresh
      handleBoundsChange(bounds);
    }
  }, [handleBoundsChange]);

  const withProgrammaticMove = useCallback((moveFn: () => void, duration = 450) => {
    isProgrammaticMoveRef.current = true;
    moveFn();
    setTimeout(() => {
      isProgrammaticMoveRef.current = false;
    }, duration);
  }, []);

  const fitToRadius = useCallback(
    (latitude: number, longitude: number, radiusKm: number) => {
      const latDelta = radiusKm / 111;
      const lonDelta = radiusKm / (111 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.1));
      const coords = [
        { latitude: latitude - latDelta, longitude: longitude - lonDelta },
        { latitude: latitude + latDelta, longitude: longitude + lonDelta },
      ];
      const paddingBottom = (mapPadding?.bottom ?? 0) + 40;
      withProgrammaticMove(() => mapRef.current?.fitToCoordinates(coords, paddingBottom));
    },
    [mapPadding, withProgrammaticMove]
  );

  const applySearch = useCallback(() => {
    setSearchApplied(true);
    setStatus('loading');
    const location = searchState.where.location;
    const selectedRadius = searchState.where.radiusKm;
    const effectiveRadius = selectedRadius && selectedRadius > 0 ? selectedRadius : 10;
    
    const moveAction = () => {
      if (location) {
        fitToRadius(location.latitude, location.longitude, effectiveRadius);
      } else if (searchState.where.radiusKm && userLocation) {
        fitToRadius(userLocation.latitude, userLocation.longitude, effectiveRadius);
      } else {
        refreshBounds();
      }
    };
    
    withProgrammaticMove(() => {
      moveAction();
      setTimeout(refreshBounds, 500); // Refresh after move is complete
    }, 600);
    
  }, [fitToRadius, refreshBounds, searchState.where, userLocation, setStatus, withProgrammaticMove]);

  const handleFeaturePress = useCallback(
    async (id: string) => {
      setStatus('loading');
      try {
        const evt = eventCacheRef.current.has(id)
          ? eventCacheRef.current.get(id)!
          : await EventsService.getEventById(id);

        if (evt) {
          if (!eventCacheRef.current.has(id)) {
            eventCacheRef.current.set(id, evt);
          }
          selectSingleEvent(evt, 1);
        } else {
          setStatus('browsing');
        }
      } catch (e) {
        console.warn('getEventById error', e);
        setStatus('browsing');
      }
    },
    [selectSingleEvent, setStatus]
  );

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
      focusOnEvent(sheetEvents[0], bottomSheetIndex);
      resultsSheetRef.current?.open?.(bottomSheetIndex);
    }
  }, [sheetStatus, activeEventId, focusOnEvent]); // Re-run when activeEventId changes

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
      if (!bounds) return;
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
          style={[styles.recenterTopButton, { bottom: insets.bottom + 96 }]}
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
            const bounds = mapRef.current?.getVisibleBounds ? mapRef.current.getVisibleBounds() : null;
            if (bounds) focusOnBounds(bounds, idx);
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
    zIndex: 12,
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
