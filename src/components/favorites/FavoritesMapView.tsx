import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { useSharedValue } from 'react-native-reanimated';
import { MapPin } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { Motion } from '@/constants/motion';
import type { EventWithCreator } from '@/types/database';
import { boundsForFavoritePins, buildFavoriteMapPins } from '@/utils/favorite-map-pins';
import {
  buildMapMarkerCollection,
  groupMapMarkerFeaturesByIcon,
  normalizeMapMarkerIconKey,
} from '@/utils/map-marker-features';
import { DEFAULT_MAP_MARKER } from '@/constants/category-visuals';
import { CategoryMarkerImages, useCategoryMarkerVisuals } from '@/components/map/CategoryMarkerImages';
import { MapEventUnitOverlay } from '@/components/search/MapEventUnitOverlay';
import { consumeBooleanFlag } from '@/utils/map-interaction-token';

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');

const EMPTY_COLLECTION = { type: 'FeatureCollection' as const, features: [] };

type Props = {
  events: EventWithCreator[];
  selectedEvent?: EventWithCreator | null;
  currentUserId?: string | null;
  isHearted?: boolean;
  onSelectEvent: (event: EventWithCreator) => void;
  onClearSelection: () => void;
  onOpenDetails: (event: EventWithCreator) => void;
  onNavigate: (event: EventWithCreator) => void;
  onToggleHeart?: (event: EventWithCreator) => void;
};

export function FavoritesMapView({
  events,
  selectedEvent,
  currentUserId,
  isHearted,
  onSelectEvent,
  onClearSelection,
  onOpenDetails,
  onNavigate,
  onToggleHeart,
}: Props) {
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const suppressNextBackgroundPressRef = useRef(false);
  const previewProgress = useSharedValue(1);
  const selectedEventId = selectedEvent?.id ?? null;
  const [styleReady, setStyleReady] = useState(false);
  const isMapboxAvailable = Boolean(MapboxGL.MapView);
  const categoryMarkerVisuals = useCategoryMarkerVisuals();
  const eventById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const pins = useMemo(() => buildFavoriteMapPins(events), [events]);
  const bounds = useMemo(() => boundsForFavoritePins(pins), [pins]);
  const markerCollection = useMemo(() => buildMapMarkerCollection(events), [events]);
  const groupedSources = useMemo(
    () => groupMapMarkerFeaturesByIcon(markerCollection.features, 'favorites-source'),
    [markerCollection],
  );
  const selectedEventShape = useMemo(() => {
    if (!selectedEventId) return EMPTY_COLLECTION;
    const feature = markerCollection.features.find(
      (item) => String((item.properties as Record<string, unknown> | null)?.id) === selectedEventId,
    );
    if (!feature) return EMPTY_COLLECTION;
    return { type: 'FeatureCollection' as const, features: [feature] };
  }, [markerCollection, selectedEventId]);
  const selectedMarkerIconKey = useMemo(() => {
    const feature = selectedEventShape.features[0];
    if (!feature) return DEFAULT_MAP_MARKER;
    return normalizeMapMarkerIconKey((feature.properties as Record<string, unknown> | null)?.icon);
  }, [selectedEventShape]);
  const unselectedFilter = useMemo(
    () =>
      selectedEventId
        ? (['!=', ['to-string', ['get', 'id']], String(selectedEventId)] as const)
        : undefined,
    [selectedEventId],
  );

  const applyCamera = useCallback(() => {
    setStyleReady(true);
    if (!pins.length) return;
    if (pins.length === 1) {
      cameraRef.current?.setCamera({
        centerCoordinate: [pins[0].longitude, pins[0].latitude],
        zoomLevel: 12,
        animationDuration: 0,
      });
      return;
    }
    if (!bounds) return;
    cameraRef.current?.fitBounds(bounds.ne, bounds.sw, 48, 0);
  }, [bounds, pins]);

  const handleMarkerPress = useCallback(
    (pressEvent: { features?: { properties?: Record<string, unknown> | null }[] }) => {
      const eventId = pressEvent.features?.[0]?.properties?.id;
      if (typeof eventId !== 'string' && typeof eventId !== 'number') return;
      const event = eventById.get(String(eventId));
      if (!event) return;
      suppressNextBackgroundPressRef.current = true;
      onSelectEvent(event);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          suppressNextBackgroundPressRef.current = false;
        });
      });
    },
    [eventById, onSelectEvent],
  );

  const handleMapPress = useCallback(() => {
    if (consumeBooleanFlag(suppressNextBackgroundPressRef)) return;
    onClearSelection();
  }, [onClearSelection]);

  if (Platform.OS === 'web' || !isMapboxAvailable) {
    return (
      <View style={styles.fallback}>
        <MapPin size={28} color={colors.brand.secondary} />
        <Text style={styles.fallbackTitle}>Carte indisponible ici</Text>
        <Text style={styles.fallbackText}>
          Ouvre l’app iOS ou Android pour voir tes favoris sur la carte.
        </Text>
      </View>
    );
  }

  if (!pins.length) {
    return (
      <View style={styles.fallback}>
        <MapPin size={28} color={colors.brand.secondary} />
        <Text style={styles.fallbackTitle}>Aucune position à afficher</Text>
        <Text style={styles.fallbackText}>
          Tes favoris filtrés n’ont pas de coordonnées utilisables.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.mapWrap} collapsable={false}>
      <MapboxGL.MapView
        style={StyleSheet.absoluteFill}
        styleURL={MapboxGL.StyleURL.Street}
        compassEnabled={false}
        onWillStartLoadingMap={() => setStyleReady(false)}
        onDidFinishLoadingStyle={() => setStyleReady(true)}
        onDidFinishLoadingMap={applyCamera}
        onPress={handleMapPress}
      >
        <CategoryMarkerImages visuals={categoryMarkerVisuals} />
        <MapboxGL.Camera
          ref={cameraRef}
          defaultSettings={
            pins.length === 1
              ? { centerCoordinate: [pins[0].longitude, pins[0].latitude], zoomLevel: 12 }
              : undefined
          }
        />
        {styleReady
          ? groupedSources.map(({ sourceId, iconKey, shape }) => (
              <MapboxGL.ShapeSource
                key={sourceId}
                id={sourceId}
                shape={shape}
                onPress={handleMarkerPress}
              >
                <MapboxGL.SymbolLayer
                  id={`${sourceId}-event-markers`}
                  filter={unselectedFilter as any}
                  style={{
                    iconImage: iconKey || DEFAULT_MAP_MARKER,
                    iconSize: 1,
                    iconAllowOverlap: true,
                    iconIgnorePlacement: true,
                    iconAnchor: 'bottom',
                    iconOffset: [0, 2],
                  }}
                />
              </MapboxGL.ShapeSource>
            ))
          : null}
        {styleReady ? (
          <MapboxGL.ShapeSource id="favorites-selected-source" shape={selectedEventShape}>
            <MapboxGL.SymbolLayer
              id="favorites-selected-marker"
              style={{
                iconImage: selectedMarkerIconKey,
                iconSize: 1.45 * Motion.transform.markerSelectedScale,
                iconAllowOverlap: true,
                iconIgnorePlacement: true,
                iconAnchor: 'bottom',
                iconOffset: [0, 2],
              }}
            />
          </MapboxGL.ShapeSource>
        ) : null}
      </MapboxGL.MapView>
      {selectedEvent ? (
        <MapEventUnitOverlay
          event={selectedEvent}
          progress={previewProgress}
          currentUserId={currentUserId}
          isHearted={isHearted}
          onToggleHeart={onToggleHeart}
          onPress={() => onOpenDetails(selectedEvent)}
          onNavigate={() => onNavigate(selectedEvent)}
          onClose={onClearSelection}
          bottomInset={spacing.md}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    flex: 1,
    minHeight: 280,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: colors.brand.surfaceMuted,
    marginBottom: spacing.md,
  },
  fallback: {
    flex: 1,
    minHeight: 280,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.brand.surface,
    marginBottom: spacing.md,
  },
  fallbackTitle: {
    ...typography.h5,
    color: colors.brand.text,
    textAlign: 'center',
  },
  fallbackText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    textAlign: 'center',
  },
});
