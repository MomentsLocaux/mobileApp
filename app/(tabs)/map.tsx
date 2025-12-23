import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { InteractionManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MapPin, Navigation } from 'lucide-react-native';
import Mapbox from '@rnmapbox/maps';
import { MapWrapper, type MapWrapperHandle } from '../../src/components/map';
import { EventsService } from '../../src/services/events.service';
import { useAuth, useLocation } from '../../src/hooks';
import {
  useLocationStore,
  useFilterStore,
  useSearchStore,
  useSearchResultsStore,
  useMapResultsUIStore,
  useMapResultsStore,
} from '../../src/store';
import { filterEvents } from '../../src/utils/filter-events';
import { sortEvents } from '../../src/utils/sort-events';
import { colors, spacing, borderRadius } from '../../src/constants/theme';
import type { EventWithCreator } from '../../src/types/database';
import { GlobalSearchBar } from '../../src/components/search/GlobalSearchBar';
import { SearchOverlayModal } from '../../src/components/search/SearchOverlayModal';
import { buildFiltersFromSearch } from '../../src/utils/search-filters';
import { SearchResultsBottomSheet, type SearchResultsBottomSheetHandle } from '../../src/components/search/SearchResultsBottomSheet';
import { NavigationOptionsSheet } from '../../src/components/search/NavigationOptionsSheet';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';
const FONTOY_COORDS = { latitude: 49.3247, longitude: 5.9947 };
const SIM_FALLBACK_COORDS = { latitude: 37.785834, longitude: -122.406417 };

export default function MapScreen() {
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const { profile } = useAuth();
  // Trigger location permission + retrieval once the map tab mounts
  useLocation();
  const { currentLocation, isLoading: locationLoading, permissionGranted } = useLocationStore();
  const { filters, focusedIds, setFilters, setFocusedIds, getActiveFilterCount } = useFilterStore();
  const searchState = useSearchStore();
  const { activeEventId, setSearchResults, setActiveEvent } = useSearchResultsStore();
  const { bottomSheetIndex, setBottomSheetIndex, bottomBarVisible, showBottomBar, hideBottomBar, updateMapPadding } =
    useMapResultsUIStore();
  const {
    bottomSheetMode,
    setBottomSheetMode,
    setBottomSheetEvents,
    setViewportEvents,
    bottomSheetEvents,
    viewportEvents,
    viewportCount,
    setBottomSheetIndex: setBSIndex,
  } = useMapResultsStore();
  const [searchVisible, setSearchVisible] = useState(false);

  const [allEvents, setAllEvents] = useState<EventWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [navEvent, setNavEvent] = useState<EventWithCreator | null>(null);
  const [zoom, setZoom] = useState(12);
  const [visibleBounds, setVisibleBounds] = useState<{ ne: [number, number]; sw: [number, number] } | null>(null);
  const lastBoundsRef = useRef<{ ne: [number, number]; sw: [number, number] } | null>(null);
  const isProgrammaticMoveRef = useRef(false);
  const hasCenteredOnUserRef = useRef(false);
  const mapRef = useRef<MapWrapperHandle>(null);
  const resultsSheetRef = useRef<SearchResultsBottomSheetHandle>(null);
  const tabTranslate = useSharedValue(0);
  const [mapMode, setMapMode] = useState<'standard' | 'satellite'>('standard');
  const focusHandledRef = useRef(false);

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

  console.log('[MapScreen] mapCenter =', mapCenter, 'userLocation =', userLocation);

  const loadEvents = useCallback(async () => {
    try {
      const data = await EventsService.listEvents();
      setAllEvents(data);
    } catch (error) {
      console.error('Error loading events:', error);
      Alert.alert('Erreur', 'Impossible de charger les événements');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const filteredAndSortedEvents = useMemo(() => {
    const filtered = filterEvents(allEvents, filters, focusedIds);
    return sortEvents(filtered, filters.sortBy || 'date', userLocation);
  }, [allEvents, filters, focusedIds, userLocation]);

  const viewportFilteredEvents = useMemo(() => {
    if (!visibleBounds) return filteredAndSortedEvents;
    const { ne, sw } = visibleBounds;
    const minLon = Math.min(ne[0], sw[0]);
    const maxLon = Math.max(ne[0], sw[0]);
    const minLat = Math.min(ne[1], sw[1]);
    const maxLat = Math.max(ne[1], sw[1]);
    return filteredAndSortedEvents.filter((e) => {
      const lon = Array.isArray(e.location?.coordinates) ? Number(e.location.coordinates[0]) : e.longitude;
      const lat = Array.isArray(e.location?.coordinates) ? Number(e.location.coordinates[1]) : e.latitude;
      if (typeof lon !== 'number' || typeof lat !== 'number') return false;
      return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
    });
  }, [filteredAndSortedEvents, visibleBounds]);

  const fitEventsSafe = useCallback(
    (eventsToFit: EventWithCreator[], padding: number) => {
      if (!eventsToFit || eventsToFit.length === 0) return;
      requestAnimationFrame(() => {
        InteractionManager.runAfterInteractions(() => {
          isProgrammaticMoveRef.current = true;
          mapRef.current?.fitToEvents(eventsToFit, padding);
          setTimeout(() => {
            isProgrammaticMoveRef.current = false;
          }, 450);
        });
      });
    },
    []
  );

  const openSheetWithEvents = useCallback(
    (mode: 'single' | 'cluster' | 'viewport', eventsToShow: EventWithCreator[], snapIndex = 1) => {
      if (!eventsToShow || eventsToShow.length === 0) return;
      setBottomSheetMode(mode);
      setBottomSheetEvents(eventsToShow);
      setActiveEvent(eventsToShow[0]?.id);

      requestAnimationFrame(() => {
        setBottomSheetIndex(snapIndex);
        setBSIndex(snapIndex);
        resultsSheetRef.current?.open?.(snapIndex);

        InteractionManager.runAfterInteractions(() => {
          const paddingValue = snapIndex === 2 ? 160 : snapIndex === 1 ? 100 : 40;
          fitEventsSafe(eventsToShow, paddingValue);
        });
      });
    },
    [fitEventsSafe, setActiveEvent, setBottomSheetEvents, setBottomSheetIndex, setBottomSheetMode, setBSIndex]
  );

  const handleMarkerPress = (event: EventWithCreator) => {
    openSheetWithEvents('single', [event], 2);
  };

  const handleClusterPress = (events: EventWithCreator[]) => {
    const eventIds = events.map((e) => e.id);
    setFocusedIds(eventIds);
    if (events[0]) {
        openSheetWithEvents('cluster', events, events.length > 5 ? 2 : 1);
    }
  };

  const applySearch = useCallback(() => {
    const derived = buildFiltersFromSearch(useSearchStore.getState(), userLocation || mapCenter);
    // Autoriser les événements passés pendant la recherche (tests élargis)
    setFilters({ ...derived, includePast: true });

    const loc = useSearchStore.getState().where.location;
    if (loc) {
      mapRef.current?.recenter({ latitude: loc.latitude, longitude: loc.longitude, zoom: 11 });
    } else if (derived.centerLat && derived.centerLon) {
      mapRef.current?.recenter({ latitude: derived.centerLat, longitude: derived.centerLon, zoom: 11 });
    }
  }, [mapCenter, setFilters, userLocation]);

  const activeFiltersCount = getActiveFilterCount();
  const recenterToUser = useCallback(() => {
    if (!userLocation) return;
    isProgrammaticMoveRef.current = true;
    mapRef.current?.recenter({
      longitude: userLocation.longitude,
      latitude: userLocation.latitude,
      zoom,
    });
    setTimeout(() => {
      isProgrammaticMoveRef.current = false;
    }, 400);
  }, [userLocation, zoom]);

  useEffect(() => {
    if (userLocation && !hasCenteredOnUserRef.current) {
      recenterToUser();
      hasCenteredOnUserRef.current = true;
    }
  }, [recenterToUser, userLocation]);

  // Ajuste la carte lorsque l'état du bottom sheet change
  useEffect(() => {
    const eventsForFit =
      bottomSheetMode === 'single' || bottomSheetMode === 'cluster'
        ? bottomSheetEvents
        : viewportEvents;
    if (!eventsForFit.length) return;
    if (bottomSheetMode === 'viewport') return; // ne pas recadrer quand l’utilisateur pan la carte
    const paddingValue = bottomSheetIndex === 2 ? 160 : bottomSheetIndex === 1 ? 100 : 40;
    fitEventsSafe(eventsForFit, paddingValue);
  }, [bottomSheetIndex, bottomSheetMode, bottomSheetEvents, viewportEvents, fitEventsSafe]);

  useEffect(() => {
    setSearchResults(filteredAndSortedEvents);
    setViewportEvents(viewportFilteredEvents);
    if (bottomSheetMode === 'idle' && filteredAndSortedEvents.length > 0) {
      // Première population : on passe en mode viewport sans recadrer automatiquement
      setBottomSheetMode('viewport');
      setBottomSheetEvents(viewportFilteredEvents);
      return;
    }

    if (bottomSheetMode === 'viewport') return; // ne pas recadrer quand l’utilisateur explore la carte

    if (filteredAndSortedEvents.length > 0) {
      const currentActive = filteredAndSortedEvents.find((e) => e.id === activeEventId);
      const first = currentActive || filteredAndSortedEvents[0];
      setActiveEvent(first.id);
      const paddingValue = bottomSheetIndex === 2 ? 160 : bottomSheetIndex === 1 ? 100 : 40;
      fitEventsSafe([first], paddingValue);
    } else {
      setActiveEvent(undefined);
    }
  }, [
    activeEventId,
    bottomSheetIndex,
    bottomSheetMode,
    filteredAndSortedEvents,
    viewportFilteredEvents,
    fitEventsSafe,
    setActiveEvent,
    setBottomSheetEvents,
    setBottomSheetMode,
    setSearchResults,
    setViewportEvents,
  ]);

  useEffect(() => {
    // reset when focus param changes
    focusHandledRef.current = false;
  }, [focus]);

  useEffect(() => {
    if (!focus) return;
    const target = filteredAndSortedEvents.find((e) => String(e.id) === String(focus));
    if (target) {
      if (!focusHandledRef.current) {
        openSheetWithEvents('single', [target], 1);
        focusHandledRef.current = true;
      }
      return;
    }
    // If not found in current list, fetch the event and add it
    (async () => {
      try {
        const fetched = await EventsService.getEventById(String(focus));
        if (fetched) {
          setAllEvents((prev) => {
            const exists = prev.some((e) => e.id === fetched.id);
            return exists ? prev : [...prev, fetched];
          });
        }
      } catch (e) {
        console.warn('focus fetch error', e);
      }
    })();
  }, [focus, filteredAndSortedEvents, openSheetWithEvents]);

  // Maintient les événements affichés dans le bottom sheet en phase avec la vue courante lorsque l’utilisateur pan
  useEffect(() => {
    if (bottomSheetMode === 'viewport') {
      setBottomSheetEvents(viewportFilteredEvents);
    }
  }, [bottomSheetMode, setBottomSheetEvents, viewportFilteredEvents]);

  useEffect(() => {
    tabTranslate.value = withTiming(bottomBarVisible ? 0 : 80, { duration: 220 });
  }, [bottomBarVisible, tabTranslate]);

  const tabAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: tabTranslate.value }],
  }));

  const mapStyle = useMemo(() => {
    switch (mapMode) {
      case 'satellite':
        return Mapbox.StyleURL.SatelliteStreet;
      default:
        return Mapbox.StyleURL.Street;
    }
  }, [mapMode]);

  const mapPitch = 0;

  if (Platform.OS === 'web' && (!MAPBOX_TOKEN || MAPBOX_TOKEN.includes('placeholder'))) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <View style={styles.fallback}>
          <MapPin size={48} color={colors.neutral[400]} />
          <Text style={styles.fallbackText}>
            Token Mapbox manquant. Configurez EXPO_PUBLIC_MAPBOX_TOKEN dans .env
          </Text>
        </View>
      </GestureHandlerRootView>
    );
  }

  if (locationLoading && !userLocation) {
    return (
      <GestureHandlerRootView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.fallbackText}>Obtention de votre position...</Text>
      </GestureHandlerRootView>
    );
  }

  if (loading) {
    return (
      <GestureHandlerRootView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.fallbackText}>Chargement de la carte...</Text>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <MapWrapper
        ref={mapRef}
        events={filteredAndSortedEvents}
        initialRegion={mapCenter}
        userLocation={userLocation}
        onMarkerPress={handleMarkerPress}
        onClusterPress={handleClusterPress}
        zoom={zoom}
        onZoomChange={setZoom}
        styleURL={mapStyle}
        pitch={mapPitch}
        onVisibleBoundsChange={(bounds) => {
          if (isProgrammaticMoveRef.current) {
            return;
          }
          const prev = lastBoundsRef.current;
          const same =
            prev &&
            Math.abs(prev.ne[0] - bounds.ne[0]) < 1e-4 &&
            Math.abs(prev.ne[1] - bounds.ne[1]) < 1e-4 &&
            Math.abs(prev.sw[0] - bounds.sw[0]) < 1e-4 &&
            Math.abs(prev.sw[1] - bounds.sw[1]) < 1e-4;
          if (!same) {
            lastBoundsRef.current = bounds;
            setVisibleBounds(bounds);
            setBottomSheetMode('viewport');
            setBottomSheetEvents(viewportEvents);
          }
        }}
      />

      <View style={styles.topOverlay}>
        <GlobalSearchBar
          onPress={() => setSearchVisible(true)}
          summary={searchState.where.location?.label}
        />
        <View style={styles.layerSwitcher}>
          {(['standard', 'satellite'] as const).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.layerButton,
                mapMode === mode && styles.layerButtonActive,
              ]}
              onPress={() => setMapMode(mode)}
            >
              <Text
                style={[
                  styles.layerButtonText,
                  mapMode === mode && styles.layerButtonTextActive,
                ]}
              >
                {mode === 'standard' ? 'Standard' : 'Satellite'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {Platform.OS === 'web' && (
        <View style={styles.zoomControl}>
          <TouchableOpacity
            style={styles.zoomButton}
            onPress={() => setZoom(Math.min(18, zoom + 1))}
          >
            <Text style={styles.zoomButtonText}>+</Text>
          </TouchableOpacity>
          <Text style={styles.zoomLevel}>{Math.round(zoom)}</Text>
          <TouchableOpacity
            style={styles.zoomButton}
            onPress={() => setZoom(Math.max(2, zoom - 1))}
          >
            <Text style={styles.zoomButtonText}>−</Text>
          </TouchableOpacity>
        </View>
      )}

      {userLocation && (
        <TouchableOpacity
          style={styles.recenterTopButton}
          onPress={recenterToUser}
        >
          <Navigation size={18} color={colors.neutral[0]} />
        </TouchableOpacity>
      )}

      <SearchOverlayModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onApply={applySearch}
      />

      <SearchResultsBottomSheet
        ref={resultsSheetRef}
        events={bottomSheetMode === 'single' || bottomSheetMode === 'cluster' ? bottomSheetEvents : viewportEvents}
        activeEventId={activeEventId}
        onSelectEvent={(event) => {
          setActiveEvent(event.id);
          fitEventsSafe([event], bottomSheetIndex === 2 ? 160 : bottomSheetIndex === 1 ? 100 : 40);
        }}
        onNavigate={(event) => setNavEvent(event)}
        onOpenDetails={(event) => router.push(`/events/${event.id}` as any)}
        onIndexChange={(idx) => {
          setBottomSheetIndex(idx);
          setBSIndex(idx);
          if (idx > 0 && bottomSheetMode === 'idle') {
            setBottomSheetMode('viewport');
            setBottomSheetEvents(viewportEvents);
          }
          if (idx <= 0) {
            hideBottomBar();
          } else {
            showBottomBar();
          }
          const paddingLevel = idx === 2 ? 'high' : idx === 1 ? 'medium' : 'low';
          updateMapPadding(paddingLevel);
        }}
        mode={bottomSheetMode === 'idle' ? 'idle' : bottomSheetMode}
        peekCount={viewportCount}
        index={bottomSheetIndex}
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
  bottomOverlay: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
    zIndex: 10,
  },
  zoomControl: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    zIndex: 10,
  },
  zoomButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.md,
    marginVertical: spacing.xs,
  },
  zoomButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  zoomLevel: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[600],
    paddingVertical: spacing.xs,
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
  recenterTopButton: {
    position: 'absolute',
    top: spacing.md,
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
});
