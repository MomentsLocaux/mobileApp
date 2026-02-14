import React, { useRef, forwardRef, useImperativeHandle, useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import {
  Baby,
  BookOpen,
  Dumbbell,
  Leaf,
  MapPin,
  Music,
  ShoppingBag,
  Sparkles,
  Theater,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react-native';
import { colors } from '@/components/ui/v2/theme';
import Constants from 'expo-constants';
import type { FeatureCollection, Feature } from 'geojson';
import { CATEGORY_MARKER_SLUGS, categoryMarkerImageKey, type CategoryMarkerSlug } from '../../constants/category-markers';
import { CategoryEventMarker } from './CategoryEventMarker';
import { useTaxonomyStore } from '../../store/taxonomyStore';

Mapbox.setAccessToken(Constants.expoConfig?.extra?.mapboxToken || process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');
Mapbox.setTelemetryEnabled(false);

type CategoryMarkerVisual = {
  color: string;
  iconColor?: string;
  Icon: LucideIcon;
};

type CategoryMarkerBaseVisual = {
  fallbackColor: string;
  iconColor?: string;
  Icon: LucideIcon;
};

const CATEGORY_MARKER_BASE_VISUALS: Record<CategoryMarkerSlug, CategoryMarkerBaseVisual> = {
  'arts-culture': { fallbackColor: '#7c3aed', Icon: Theater },
  'marches-artisanat': { fallbackColor: '#0ea5e9', Icon: ShoppingBag },
  'fetes-animations': { fallbackColor: '#f97316', Icon: Music },
  'famille-enfants': { fallbackColor: '#16a34a', Icon: Baby },
  'gastronomie-saveurs': { fallbackColor: '#facc15', Icon: UtensilsCrossed, iconColor: '#3f2d00' },
  'nature-bienetre': { fallbackColor: '#22c55e', Icon: Leaf },
  'ateliers-apprentissage': { fallbackColor: '#6366f1', Icon: BookOpen },
  'sport-loisirs': { fallbackColor: '#f43f5e', Icon: Dumbbell },
  'vie-locale': { fallbackColor: '#0ea5e9', Icon: Users },
  'insolite-ephemere': { fallbackColor: '#a855f7', Icon: Sparkles },
};

const DEFAULT_EVENT_ICON_KEY = 'marker-15';
const EMPTY_FEATURE_COLLECTION: FeatureCollection = { type: 'FeatureCollection', features: [] };

const normalizeEventIconKey = (feature: Feature): string => {
  const rawIcon = (feature.properties as Record<string, unknown> | null)?.icon;
  if (typeof rawIcon !== 'string') return DEFAULT_EVENT_ICON_KEY;
  const icon = rawIcon.trim();
  if (!icon) return DEFAULT_EVENT_ICON_KEY;
  return icon;
};

const toSourceId = (iconKey: string) => `events-source-${iconKey.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

const CategoryMarkerImages = React.memo(function CategoryMarkerImages({
  visuals,
}: {
  visuals: Record<CategoryMarkerSlug, CategoryMarkerVisual>;
}) {
  return (
    <Mapbox.Images>
      {CATEGORY_MARKER_SLUGS.map((slug) => {
        const visual = visuals[slug];
        return (
          <Mapbox.Image key={slug} name={categoryMarkerImageKey(slug)}>
            <CategoryEventMarker color={visual.color} Icon={visual.Icon} iconColor={visual.iconColor} />
          </Mapbox.Image>
        );
      })}
    </Mapbox.Images>
  );
});

interface MapWrapperProps {
  initialRegion: {
    latitude: number;
    longitude: number;
    zoom: number;
  };
  userLocation?: { latitude: number; longitude: number } | null;
  onFeaturePress: (featureId: string) => void;
  onZoomChange?: (zoom: number) => void;
  onVisibleBoundsChange?: (bounds: { ne: [number, number]; sw: [number, number] }) => void;
  children?: React.ReactNode;
  styleURL?: string;
  mapPadding?: { top: number; right: number; bottom: number; left: number };
}

export type MapWrapperHandle = {
  recenter: (options: { longitude: number; latitude: number; zoom?: number }) => void;
  setShape: (fc: FeatureCollection) => void;
  fitToCoordinates: (coordinates: { longitude: number; latitude: number }[], padding?: number) => void;
  getVisibleBounds: () => Promise<{ ne: [number, number]; sw: [number, number] } | null>;
  focusOnCoordinate: (options: {
    longitude: number;
    latitude: number;
    zoom?: number;
    paddingBottom?: number;
  }) => void;
};

export const MapWrapper = forwardRef<MapWrapperHandle, MapWrapperProps>(
  (
    {
      initialRegion,
      userLocation,
      onFeaturePress,
      onZoomChange,
      onVisibleBoundsChange,
      children,
      styleURL,
      mapPadding,
    },
    ref
  ) => {
  const isMapboxAvailable = !!Mapbox.MapView;
  const categoriesMap = useTaxonomyStore((state) => state.categoriesMap);
  const mapViewRef = useRef<Mapbox.MapView>(null);
  const shapeSourceRefs = useRef<Record<string, any>>({});
  const cameraRef = useRef<Mapbox.Camera>(null);
  const lastBoundsRef = useRef<{ sw: [number, number]; ne: [number, number] } | null>(null);
  const [eventsShape, setEventsShape] = useState<FeatureCollection>(EMPTY_FEATURE_COLLECTION);

  const toCameraPadding = (padding?: { top: number; right: number; bottom: number; left: number }) => {
    if (!padding) return undefined;
    return {
      paddingTop: padding.top,
      paddingRight: padding.right,
      paddingBottom: padding.bottom,
      paddingLeft: padding.left,
    };
  };

  const hasBoundsChanged = (next: { sw: [number, number]; ne: [number, number] }) => {
    const prev = lastBoundsRef.current;
    if (!prev) return true;
    const eq = (a: [number, number], b: [number, number]) =>
      Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
    return !eq(prev.sw, next.sw) || !eq(prev.ne, next.ne);
  };

  const emitVisibleBounds = useCallback(async () => {
    if (!mapViewRef.current) return;
    try {
      const bounds = await mapViewRef.current.getVisibleBounds();
      if (Array.isArray(bounds) && bounds.length === 2) {
        const next = { sw: bounds[0] as [number, number], ne: bounds[1] as [number, number] };
        if (hasBoundsChanged(next)) {
          lastBoundsRef.current = next;
          onVisibleBoundsChange?.(next);
        }
      }
    } catch (e) {
      console.warn('getVisibleBounds failed', e);
    }
  }, [onVisibleBoundsChange]);

  const categoryMarkerVisuals = useMemo(() => {
    const visuals = {} as Record<CategoryMarkerSlug, CategoryMarkerVisual>;
    CATEGORY_MARKER_SLUGS.forEach((slug) => {
      const base = CATEGORY_MARKER_BASE_VISUALS[slug];
      const categoryColor = categoriesMap[slug]?.color;
      const color =
        typeof categoryColor === 'string' && categoryColor.trim().length > 0 ? categoryColor : base.fallbackColor;
      visuals[slug] = {
        color,
        iconColor: base.iconColor,
        Icon: base.Icon,
      };
    });
    return visuals;
  }, [categoriesMap]);

  const groupedEventSources = useMemo(() => {
    const featuresByIcon: Record<string, Feature[]> = {};
    (eventsShape.features || []).forEach((feature) => {
      const iconKey = normalizeEventIconKey(feature);
      if (!featuresByIcon[iconKey]) {
        featuresByIcon[iconKey] = [];
      }
      featuresByIcon[iconKey].push(feature);
    });

    return Object.entries(featuresByIcon).map(([iconKey, features]) => ({
      iconKey,
      sourceId: toSourceId(iconKey),
      shape: {
        type: 'FeatureCollection',
        features,
      } as FeatureCollection,
    }));
  }, [eventsShape]);

  const setShapeSourceRef = useCallback((sourceId: string, sourceRef: any | null) => {
    if (sourceRef) {
      shapeSourceRefs.current[sourceId] = sourceRef;
      return;
    }
    delete shapeSourceRefs.current[sourceId];
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      recenter: ({ longitude, latitude, zoom: zoomLevel }) => {
        cameraRef.current?.setCamera({
          centerCoordinate: [longitude, latitude],
          zoomLevel: zoomLevel ?? initialRegion.zoom,
          animationDuration: 300,
        });
      },
      setShape: (fc: FeatureCollection) => {
        const nextShape = fc?.type === 'FeatureCollection' ? fc : EMPTY_FEATURE_COLLECTION;
        setEventsShape(nextShape);
      },
      fitToCoordinates: (coords, padding = 40) => {
        if (!coords || coords.length === 0) return;
        if (coords.length === 1) {
          const c = coords[0];
          cameraRef.current?.setCamera({
            centerCoordinate: [c.longitude, c.latitude],
            zoomLevel: 12,
            animationDuration: 300,
          });
          return;
        }
        let minLat = 90,
          maxLat = -90,
          minLon = 180,
          maxLon = -180;
        coords.forEach((c) => {
          if (c.latitude < minLat) minLat = c.latitude;
          if (c.latitude > maxLat) maxLat = c.latitude;
          if (c.longitude < minLon) minLon = c.longitude;
          if (c.longitude > maxLon) maxLon = c.longitude;
        });
        cameraRef.current?.fitBounds([minLon, minLat], [maxLon, maxLat], padding, 300);
      },
      getVisibleBounds: async () => {
        if (!mapViewRef.current) return null;
        try {
          const bounds = await mapViewRef.current.getVisibleBounds();
          if (Array.isArray(bounds) && bounds.length === 2) {
            return { sw: bounds[0] as [number, number], ne: bounds[1] as [number, number] };
          }
        } catch (e) {
          console.warn('getVisibleBounds failed', e);
        }
        return null;
      },
      focusOnCoordinate: ({ longitude, latitude, zoom: zoomLevel, paddingBottom }) => {
        cameraRef.current?.setCamera({
          centerCoordinate: [longitude, latitude],
          zoomLevel: zoomLevel ?? initialRegion.zoom,
          padding: {
            paddingTop: 40,
            paddingBottom: paddingBottom ?? 0,
            paddingLeft: 20,
            paddingRight: 20,
          },
          animationDuration: 300,
        });
      },
    }),
    [initialRegion.zoom]
  );

  if (Platform.OS === 'web' || !isMapboxAvailable) {
    return (
      <View style={styles.unavailableContainer}>
        <MapPin size={36} color={colors.scale.neutral[400]} />
        <Text style={styles.unavailableTitle}>Carte non disponible sur le web</Text>
        <Text style={styles.unavailableText}>
          Ouvre l&apos;app avec un client Expo Dev (iOS/Android) pour voir la carte Mapbox.
        </Text>
      </View>
    );
  }

  const handlePress = async (event: any, sourceId: string) => {
    const feature = event.features?.[0];
    if (!feature) return;

    const isCluster = Boolean(feature.properties?.cluster) || feature.properties?.point_count != null;
    if (isCluster) {
      const coordinates = feature.geometry?.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) return;

      const [longitude, latitude] = coordinates;
      const source = shapeSourceRefs.current[sourceId];
      let expansionZoom: number | undefined;

      if (source && typeof source.getClusterExpansionZoom === 'function') {
        try {
          const zoom = await source.getClusterExpansionZoom(feature);
          if (typeof zoom === 'number' && Number.isFinite(zoom)) {
            expansionZoom = zoom;
          }
        } catch (error) {
          console.warn('cluster expansion zoom failed', error);
        }
      }

      cameraRef.current?.setCamera({
        centerCoordinate: [Number(longitude), Number(latitude)],
        zoomLevel: expansionZoom ?? initialRegion.zoom + 2,
        animationDuration: 280,
      });
      return;
    }

    const eventId = feature.properties?.id;
    if (eventId) {
      onFeaturePress(String(eventId));
    }
  };

  return (
    <View style={styles.container}>
      <Mapbox.MapView
        ref={mapViewRef}
        style={styles.map}
        styleURL={styleURL || Mapbox.StyleURL.Street}
        onCameraChanged={emitVisibleBounds}
        onMapIdle={async (event) => {
          const zoomLevel = (event.properties as any)?.zoomLevel ?? (event.properties as any)?.zoom;
          if (onZoomChange && typeof zoomLevel === 'number') {
            onZoomChange(zoomLevel);
          }
          await emitVisibleBounds();
        }}
      >
        <CategoryMarkerImages visuals={categoryMarkerVisuals} />

        <Mapbox.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [initialRegion.longitude, initialRegion.latitude],
            zoomLevel: initialRegion.zoom,
            pitch: 0,
            heading: 0,
          }}
          padding={toCameraPadding(mapPadding)}
        />

        <Mapbox.UserLocation visible={true} showsUserHeadingIndicator={true} />

        {userLocation && (
          <Mapbox.ShapeSource
            id="user-location"
            shape={{
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [userLocation.longitude, userLocation.latitude] },
              properties: {},
            }}
          >
            <Mapbox.SymbolLayer
              id="user-location-symbol"
              style={{
                iconImage: 'marker-15',
                iconSize: 1.6,
                iconAllowOverlap: true,
                iconIgnorePlacement: true,
                iconColor: colors.secondary[600] ?? '#ff7f50',
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {groupedEventSources.map(({ sourceId, iconKey, shape }) => (
          <Mapbox.ShapeSource
            key={sourceId}
            id={sourceId}
            ref={(sourceRef) => setShapeSourceRef(sourceId, sourceRef)}
            shape={shape}
            cluster={true}
            clusterRadius={50}
            clusterMaxZoomLevel={14}
            onPress={(event) => {
              void handlePress(event, sourceId);
            }}
          >
            <Mapbox.SymbolLayer
              id={`${sourceId}-cluster-icon`}
              filter={['has', 'point_count']}
              style={{
                iconImage: iconKey || DEFAULT_EVENT_ICON_KEY,
                iconSize: ['step', ['get', 'point_count'], 0.95, 8, 1.05, 24, 1.15],
                iconAllowOverlap: true,
                iconIgnorePlacement: true,
              }}
            />
            <Mapbox.SymbolLayer
              id={`${sourceId}-cluster-count`}
              filter={['has', 'point_count']}
              style={{
                textField: ['get', 'point_count_abbreviated'],
                textSize: 11,
                textColor: colors.scale.neutral[900],
                textHaloColor: colors.scale.neutral[0],
                textHaloWidth: 1.2,
                textOffset: [0, 2.1],
                textAllowOverlap: true,
                textIgnorePlacement: true,
              }}
            />
            <Mapbox.SymbolLayer
              id={`${sourceId}-event-markers`}
              filter={['!', ['has', 'point_count']]}
              style={{
                iconImage: iconKey || DEFAULT_EVENT_ICON_KEY,
                iconSize: 1,
                iconAllowOverlap: true,
                iconIgnorePlacement: true,
              }}
            />
          </Mapbox.ShapeSource>
        ))}
        {children}
      </Mapbox.MapView>
    </View>
  );
});
MapWrapper.displayName = 'MapWrapper';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  unavailableContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  unavailableTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.scale.neutral[700],
  },
  unavailableText: {
    fontSize: 14,
    textAlign: 'center',
    color: colors.scale.neutral[600],
  },
});
