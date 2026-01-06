import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, Platform, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MapPin, Navigation } from 'lucide-react-native';
import Mapbox from '@rnmapbox/maps';
import { useFocusEffect } from '@react-navigation/native';
import { MapWrapper, type MapWrapperHandle } from '../../src/components/map';
import { EventsService } from '../../src/services/events.service';
import { SocialService } from '../../src/services/social.service';
import { useLocation } from '../../src/hooks';
import {
  useLocationStore,
  useSearchResultsStore,
  useSearchStore,
  useMapResultsUIStore,
} from '../../src/store';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useAuth } from '@/hooks';
import { colors, spacing, borderRadius } from '../../src/constants/theme';
import { GlobalSearchBar } from '../../src/components/search/GlobalSearchBar';
import { SearchOverlayModal } from '../../src/components/search/SearchOverlayModal';
import { SearchResultsBottomSheet, type SearchResultsBottomSheetHandle } from '../../src/components/search/SearchResultsBottomSheet';
import { NavigationOptionsSheet } from '../../src/components/search/NavigationOptionsSheet';
import type { EventWithCreator } from '../../src/types/database';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';
const FONTOY_COORDS = { latitude: 49.3247, longitude: 5.9947 };
const SIM_FALLBACK_COORDS = { latitude: 37.785834, longitude: -122.406417 };

export default function MapScreen() {
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  // Trigger location permission + retrieval once the map tab mounts
  useLocation();
  const { currentLocation, isLoading: locationLoading } = useLocationStore();
  const { activeEventId, setActiveEvent } = useSearchResultsStore();
  const { when } = useSearchStore();
  const { profile } = useAuth();
  const { favorites, toggleFavorite, isFavorite } = useFavoritesStore();
  const { bottomSheetIndex, setBottomSheetIndex, bottomBarVisible, showBottomBar, hideBottomBar, updateMapPadding, mapPaddingLevel } =
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
  const includePast = !!when.includePast;
  const focusHandledRef = useRef(false);
  const [sheetEvents, setSheetEvents] = useState<EventWithCreator[]>([]);
  const [sheetMode, setSheetMode] = useState<'viewport' | 'single'>('viewport');
  const [visibleEventCount, setVisibleEventCount] = useState(0);
  const bboxTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const eventCacheRef = useRef<Map<string, EventWithCreator>>(new Map());
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

  const recenterToUser = useCallback(() => {
    if (!userLocation) return;
    // Recentrer sur l'utilisateur avec une zone équivalente à ~15 km de circonférence (~7.5 km de diamètre) autour
    const radiusKm = 7.5; // moitié de la circonférence ciblée
    const lat = userLocation.latitude;
    const lon = userLocation.longitude;
    const latDelta = radiusKm / 111; // ~111 km par degré de latitude
    const lonDelta = radiusKm / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.1)); // éviter division par 0
    const coords = [
      { latitude: lat - latDelta, longitude: lon - lonDelta },
      { latitude: lat + latDelta, longitude: lon + lonDelta },
    ];
    const paddingBottom = (mapPadding?.bottom ?? 0) + 40;

    isProgrammaticMoveRef.current = true;
    mapRef.current?.fitToCoordinates(coords, paddingBottom);
    setTimeout(() => {
      isProgrammaticMoveRef.current = false;
    }, 400);
  }, [mapPadding, userLocation]);

  useEffect(() => {
    if (userLocation && !hasCenteredOnUserRef.current) {
      recenterToUser();
      hasCenteredOnUserRef.current = true;
    }
  }, [recenterToUser, userLocation]);

  // À chaque retour sur l’onglet carte, on repart en mode peek (pas d’ouverture auto).
  useFocusEffect(
    useCallback(() => {
      setBottomSheetIndex(0);
      hideBottomBar();
      setSheetMode('viewport');
      setActiveEvent(undefined);
      // On laisse les résultats existants pour que le peek affiche immédiatement le comptage.
    }, [hideBottomBar, setActiveEvent, setBottomSheetIndex])
  );

  const handleBoundsChange = useCallback((bounds: { ne: [number, number]; sw: [number, number] }) => {
    if (isProgrammaticMoveRef.current) return;
    const prev = lastBoundsRef.current;
    const same =
      prev &&
      Math.abs(prev.ne[0] - bounds.ne[0]) < 0.002 &&
      Math.abs(prev.ne[1] - bounds.ne[1]) < 0.002 &&
      Math.abs(prev.sw[0] - bounds.sw[0]) < 0.002 &&
      Math.abs(prev.sw[1] - bounds.sw[1]) < 0.002;
    if (same) return;
    lastBoundsRef.current = bounds;

    if (bboxTimeoutRef.current) {
      clearTimeout(bboxTimeoutRef.current);
    }

    bboxTimeoutRef.current = setTimeout(async () => {
      try {
        const featureCollection = await EventsService.listEventsByBBox({
          ne: bounds.ne,
          sw: bounds.sw,
          limit: 300,
          includePast,
        });
        const ids =
          featureCollection?.features
            ?.map((f: any) => f?.properties?.id)
            .filter(Boolean) || [];
        const uniqueIds = Array.from(new Set(ids)) as string[];
        const limitedIds = uniqueIds.slice(0, 120); // cap to avoid timeouts
        const events = limitedIds.length ? await EventsService.getEventsByIds(limitedIds) : [];
        setSheetMode('viewport');
        setActiveEvent(undefined);
        setSheetEvents(events);
        setVisibleEventCount(featureCollection?.features?.length || 0);
        mapRef.current?.setShape(featureCollection as any);
      } catch (e) {
        console.warn('bbox fetch error', e);
      }
    }, 300);
  }, [includePast, setActiveEvent]);

  useEffect(() => {
    if (!lastBoundsRef.current) return;
    const bounds = lastBoundsRef.current;
    lastBoundsRef.current = null;
    handleBoundsChange(bounds);
  }, [handleBoundsChange, includePast]);

  const openEventInSheet = useCallback(
    (event: EventWithCreator, snapIndex = 1) => {
      if (!event) return;
      setSheetEvents([event]);
      setSheetMode('single');
      setActiveEvent(event.id);
      requestAnimationFrame(() => {
        setBottomSheetIndex(snapIndex);
        resultsSheetRef.current?.open?.(snapIndex);
        showBottomBar();
        updateMapPadding(snapIndex === 2 ? 'high' : 'medium');
        focusOnEvent(event, snapIndex);
      });
    },
    [focusOnEvent, setActiveEvent, setBottomSheetIndex, showBottomBar, updateMapPadding]
  );

  const handleFeaturePress = useCallback(
    async (id: string) => {
      try {
        if (eventCacheRef.current.has(id)) {
          openEventInSheet(eventCacheRef.current.get(id)!, 1);
          return;
        }
        const evt = await EventsService.getEventById(id);
        if (evt) {
          eventCacheRef.current.set(id, evt);
          openEventInSheet(evt, 1);
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
          openEventInSheet(evt, 1);
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

  const focusOnEvent = useCallback(
    (event: EventWithCreator, snapIndex: number) => {
      if (!event || typeof event.longitude !== 'number' || typeof event.latitude !== 'number') return;
      const paddingBottom = getPaddingFromIndex(snapIndex);
      const targetZoom = Math.max(2, zoom - 0.5);
      mapRef.current?.focusOnCoordinate({
        longitude: event.longitude,
        latitude: event.latitude,
        zoom: targetZoom,
        paddingBottom,
      });
    },
    [getPaddingFromIndex, zoom]
  );

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
      isProgrammaticMoveRef.current = true;
      mapRef.current?.fitToCoordinates(coords, paddingBottom);
      setTimeout(() => {
        isProgrammaticMoveRef.current = false;
      }, 300);
    },
    [getPaddingFromIndex]
  );

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
        onZoomChange={setZoom}
        styleURL={mapStyle}
        mapPadding={mapPadding}
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
        onOpenCreator={(creatorId) => router.push(`/community/${creatorId}` as any)}
        onToggleFavorite={handleToggleFavorite}
        isFavorite={(id) => favoritesSet.has(id)}
        onIndexChange={(idx) => {
          setBottomSheetIndex(idx);
          if (idx <= 0) {
            hideBottomBar();
            setSheetMode('viewport');
            setActiveEvent(undefined);
            setSheetEvents((events) => events);
          } else {
            showBottomBar();
          }
          const paddingLevel = idx === 2 ? 'high' : idx === 1 ? 'medium' : 'low';
          updateMapPadding(paddingLevel);
          // Si l'utilisateur ouvre manuellement la sheet en mode viewport, recadrer sur la zone visible,
          // mais ne pas bouger la carte lorsque la sheet est au maximum (idx 2).
          if (idx === 1 && sheetMode === 'viewport') {
            focusOnBounds(lastBoundsRef.current, idx);
          }
        }}
        mode={sheetMode}
        peekCount={sheetMode === 'single' ? 0 : visibleEventCount}
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
