import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
} from 'react-native';
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
  useSearchResultsStore,
  useMapResultsUIStore,
} from '../../src/store';
import { colors, spacing, borderRadius } from '../../src/constants/theme';
import { GlobalSearchBar } from '../../src/components/search/GlobalSearchBar';
import { SearchOverlayModal } from '../../src/components/search/SearchOverlayModal';
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
  const { activeEventId, setActiveEvent } = useSearchResultsStore();
  const { bottomSheetIndex, setBottomSheetIndex, bottomBarVisible, showBottomBar, hideBottomBar, updateMapPadding } =
    useMapResultsUIStore();
  const [searchVisible, setSearchVisible] = useState(false);

  const [loading] = useState(false);
  const [navEvent, setNavEvent] = useState<any | null>(null);
  const [zoom, setZoom] = useState(12);
  const lastBoundsRef = useRef<{ ne: [number, number]; sw: [number, number] } | null>(null);
  const isProgrammaticMoveRef = useRef(false);
  const hasCenteredOnUserRef = useRef(false);
  const mapRef = useRef<MapWrapperHandle>(null);
  const resultsSheetRef = useRef<SearchResultsBottomSheetHandle>(null);
  const tabTranslate = useSharedValue(0);
  const [mapMode, setMapMode] = useState<'standard' | 'satellite'>('standard');
  const focusHandledRef = useRef(false);
  const [sheetEvents, setSheetEvents] = useState<any[]>([]);
  const [sheetMode, setSheetMode] = useState<'idle' | 'single' | 'cluster'>('idle');

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

  const handleBoundsChange = useCallback((bounds: { ne: [number, number]; sw: [number, number] }) => {
    if (isProgrammaticMoveRef.current) return;
    const prev = lastBoundsRef.current;
    const same =
      prev &&
      Math.abs(prev.ne[0] - bounds.ne[0]) < 1e-4 &&
      Math.abs(prev.ne[1] - bounds.ne[1]) < 1e-4 &&
      Math.abs(prev.sw[0] - bounds.sw[0]) < 1e-4 &&
      Math.abs(prev.sw[1] - bounds.sw[1]) < 1e-4;
    if (same) return;
    lastBoundsRef.current = bounds;
    (async () => {
      try {
        const geojson = await EventsService.listEventsByBBox({
          ne: bounds.ne,
          sw: bounds.sw,
          limit: 300,
        });
        mapRef.current?.setShape(geojson as any);
      } catch (e) {
        console.warn('bbox fetch error', e);
      }
    })();
  }, []);

  const openEventInSheet = useCallback(
    (event: any, snapIndex = 1) => {
      if (!event) return;
      setSheetEvents([event]);
      setSheetMode('single');
      setActiveEvent(event.id);
      requestAnimationFrame(() => {
        setBottomSheetIndex(snapIndex);
        resultsSheetRef.current?.open?.(snapIndex);
        showBottomBar();
        updateMapPadding(snapIndex === 2 ? 'high' : snapIndex === 1 ? 'medium' : 'low');
      });
    },
    [setActiveEvent, setBottomSheetIndex, showBottomBar, updateMapPadding]
  );

  const handleFeaturePress = useCallback(
    async (id: string) => {
      try {
        const evt = await EventsService.getEventById(id);
        if (evt) {
          openEventInSheet(evt, 2);
        }
      } catch (e) {
        console.warn('getEventById error', e);
      }
    },
    [openEventInSheet]
  );

  useEffect(() => {
    // reset when focus param changes
    focusHandledRef.current = false;
  }, [focus]);

  useEffect(() => {
    if (!focus) return;
    (async () => {
      try {
        const evt = await EventsService.getEventById(String(focus));
        if (evt && !focusHandledRef.current) {
          openEventInSheet(evt, 2);
          focusHandledRef.current = true;
        }
      } catch (e) {
        console.warn('focus fetch error', e);
      }
    })();
  }, [focus, openEventInSheet]);

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

  return (
    <GestureHandlerRootView style={styles.container}>
      <MapWrapper
        ref={mapRef}
        initialRegion={mapCenter}
        userLocation={userLocation}
        onFeaturePress={handleFeaturePress}
        onClusterPress={async (ids) => {
          try {
            const uniqueIds = Array.from(new Set((ids || []).map((id) => String(id)))).slice(0, 50);
            const events = uniqueIds.length ? await EventsService.getEventsByIds(uniqueIds) : [];
            setSheetMode('cluster');
            setSheetEvents(events);
            setActiveEvent(events.length ? events[0].id : undefined);
            setBottomSheetIndex(0);
            resultsSheetRef.current?.open?.(0);
            hideBottomBar();
            updateMapPadding('low');
          } catch (e) {
            console.warn('cluster fetch error', e);
          }
        }}
        onZoomChange={setZoom}
        styleURL={mapStyle}
        onVisibleBoundsChange={(bounds) => {
          handleBoundsChange(bounds);
        }}
      />

      <View style={styles.topOverlay}>
        <GlobalSearchBar onPress={() => setSearchVisible(true)} />
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
        onApply={() => setSearchVisible(false)}
      />

      <SearchResultsBottomSheet
        ref={resultsSheetRef}
        events={sheetEvents}
        activeEventId={activeEventId}
        onSelectEvent={(event) => {
          setActiveEvent(event.id);
        }}
        onNavigate={(event) => setNavEvent(event)}
        onOpenDetails={(event) => router.push(`/events/${event.id}` as any)}
        onIndexChange={(idx) => {
          setBottomSheetIndex(idx);
          if (idx <= 0) {
            hideBottomBar();
            setSheetMode('idle');
          } else {
            showBottomBar();
          }
          const paddingLevel = idx === 2 ? 'high' : idx === 1 ? 'medium' : 'low';
          updateMapPadding(paddingLevel);
        }}
        mode={sheetMode}
        peekCount={sheetEvents.length}
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
