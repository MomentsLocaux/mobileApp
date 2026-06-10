import React, { useRef, forwardRef, useImperativeHandle, useCallback, useMemo, useState, useEffect } from 'react';
import { runOnJS, useAnimatedReaction, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { Motion } from '@/constants/motion';
import { StyleSheet, View, Text, Platform } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { MapPin, Users, type LucideIcon } from 'lucide-react-native';
import { colors } from '../../constants/theme';
import Constants from 'expo-constants';
import type { FeatureCollection, Feature } from 'geojson';
import {
  CATEGORY_VISUAL_SLUGS,
  CATEGORY_VISUALS,
  categoryClusterMarkerImageKey,
  categoryMarkerImageKey,
  DEFAULT_CLUSTER_MAP_MARKER,
  DEFAULT_MAP_MARKER,
  toClusterMarkerImageKey,
  type CategoryVisualSlug,
} from '../../constants/category-visuals';
import { CategoryEventMarker } from './CategoryEventMarker';
import { useTaxonomyStore } from '../../store/taxonomyStore';
import { MAP_CAMERA_ANIMATION_MS } from '../../utils/map-sheet-layout';

Mapbox.setAccessToken(Constants.expoConfig?.extra?.mapboxToken || process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');
Mapbox.setTelemetryEnabled(false);

type CategoryMarkerVisual = {
  color: string;
  iconColor?: string;
  Icon: LucideIcon;
};

const EMPTY_FEATURE_COLLECTION: FeatureCollection = { type: 'FeatureCollection', features: [] };

const normalizeEventIconKey = (feature: Feature): string => {
  const rawIcon = (feature.properties as Record<string, unknown> | null)?.icon;
  if (typeof rawIcon !== 'string') return DEFAULT_MAP_MARKER;
  const icon = rawIcon.trim();
  if (!icon) return DEFAULT_MAP_MARKER;
  return icon;
};

const toSourceId = (iconKey: string) => `events-source-${iconKey.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

const CategoryMarkerImages = React.memo(function CategoryMarkerImages({
  visuals,
}: {
  visuals: Record<CategoryVisualSlug, CategoryMarkerVisual>;
}) {
  return (
    <Mapbox.Images>
      {CATEGORY_VISUAL_SLUGS.map((slug) => {
        const visual = visuals[slug];
        return (
          <React.Fragment key={slug}>
            <Mapbox.Image name={categoryMarkerImageKey(slug)}>
              <CategoryEventMarker color={visual.color} Icon={visual.Icon} iconColor={visual.iconColor} />
            </Mapbox.Image>
            <Mapbox.Image name={categoryClusterMarkerImageKey(slug)}>
              <CategoryEventMarker color={visual.color} Icon={visual.Icon} variant="cluster" />
            </Mapbox.Image>
          </React.Fragment>
        );
      })}
      <Mapbox.Image name={DEFAULT_MAP_MARKER}>
        <CategoryEventMarker color={colors.primary[500]} Icon={Users} />
      </Mapbox.Image>
      <Mapbox.Image name={DEFAULT_CLUSTER_MAP_MARKER}>
        <CategoryEventMarker color={colors.primary[500]} Icon={Users} variant="cluster" />
      </Mapbox.Image>
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
  onVisibleBoundsChange?: (
    bounds: { ne: [number, number]; sw: [number, number] },
    meta?: { isUserInteraction: boolean }
  ) => void;
  onMapReady?: () => void;
  onMapBackgroundPress?: () => void;
  onUserMapGestureStart?: () => void;
  activeEventId?: string;
  children?: React.ReactNode;
  styleURL?: string;
  mapPadding?: { top: number; right: number; bottom: number; left: number };
}

export type MapWrapperHandle = {
  recenter: (options: { longitude: number; latitude: number; zoom?: number }) => void;
  setShape: (fc: FeatureCollection) => void;
  fitToCoordinates: (coordinates: { longitude: number; latitude: number }[], padding?: number) => void;
  fitToBounds: (
    bounds: { ne: [number, number]; sw: [number, number] },
    padding?: number,
    animationDuration?: number
  ) => void;
  getVisibleBounds: () => Promise<{ ne: [number, number]; sw: [number, number] } | null>;
  focusOnCoordinate: (options: {
    longitude: number;
    latitude: number;
    zoom?: number;
    paddingBottom?: number;
  }) => void;
  clearBoundsCache: () => void;
};

export const MapWrapper = forwardRef<MapWrapperHandle, MapWrapperProps>(
  (
    {
      initialRegion,
      userLocation,
      onFeaturePress,
      onZoomChange,
      onVisibleBoundsChange,
      onMapReady,
      onMapBackgroundPress,
      onUserMapGestureStart,
      activeEventId,
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
  const pendingUserInteractionRef = useRef(false);
  const userTouchDragRef = useRef(false);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const lastMarkerPressAtRef = useRef(0);
  const [eventsShape, setEventsShape] = useState<FeatureCollection>(EMPTY_FEATURE_COLLECTION);
  const [selectedIconSize, setSelectedIconSize] = useState(1.45);
  const selectedIconScale = useSharedValue(1.45);

  useEffect(() => {
    if (!activeEventId) {
      selectedIconScale.value = 1.45;
      setSelectedIconSize(1.45);
      return;
    }
    selectedIconScale.value = withSequence(
      withSpring(1.45 * Motion.transform.markerSelectedScale, Motion.spring.soft),
      withSpring(1.45, Motion.spring.soft)
    );
  }, [activeEventId, selectedIconScale]);

  useAnimatedReaction(
    () => selectedIconScale.value,
    (value) => {
      runOnJS(setSelectedIconSize)(value);
    },
    [selectedIconScale]
  );

  const TOUCH_DRAG_THRESHOLD_PX = 8;

  const markUserMapGesture = useCallback(() => {
    pendingUserInteractionRef.current = true;
    onUserMapGestureStart?.();
  }, [onUserMapGestureStart]);

  const resolveUserInteraction = useCallback((event?: { properties?: unknown }) => {
    const props = event?.properties as Record<string, unknown> | undefined;
    return (
      pendingUserInteractionRef.current ||
      userTouchDragRef.current ||
      props?.isUserInteraction === true
    );
  }, []);

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

  const emitVisibleBounds = useCallback(
    async (meta?: { isUserInteraction: boolean }) => {
      if (!mapViewRef.current) return;
      try {
        const bounds = await mapViewRef.current.getVisibleBounds();
        if (Array.isArray(bounds) && bounds.length === 2) {
          const next = { sw: bounds[0] as [number, number], ne: bounds[1] as [number, number] };
          if (hasBoundsChanged(next)) {
            lastBoundsRef.current = next;
            onVisibleBoundsChange?.(next, meta);
          } else if (meta?.isUserInteraction) {
            onVisibleBoundsChange?.(next, meta);
          }
        }
      } catch (e) {
        console.warn('getVisibleBounds failed', e);
      }
    },
    [onVisibleBoundsChange]
  );

  const categoryMarkerVisuals = useMemo(() => {
    const visuals = {} as Record<CategoryVisualSlug, CategoryMarkerVisual>;
    CATEGORY_VISUAL_SLUGS.forEach((slug) => {
      const base = CATEGORY_VISUALS[slug as CategoryVisualSlug];
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

  const selectedEventShape = useMemo((): FeatureCollection => {
    if (!activeEventId) return EMPTY_FEATURE_COLLECTION;
    const feature = (eventsShape.features || []).find(
      (item) => String((item.properties as Record<string, unknown> | null)?.id) === activeEventId
    );
    if (!feature) return EMPTY_FEATURE_COLLECTION;
    return { type: 'FeatureCollection', features: [feature] };
  }, [activeEventId, eventsShape]);

  const selectedMarkerIconKey = useMemo(() => {
    const feature = selectedEventShape.features[0];
    if (!feature) return DEFAULT_MAP_MARKER;
    return normalizeEventIconKey(feature);
  }, [selectedEventShape]);

  useEffect(() => {
    if (!mapPadding) return;
    cameraRef.current?.setCamera({
      padding: toCameraPadding(mapPadding),
      animationDuration: MAP_CAMERA_ANIMATION_MS,
    });
  }, [mapPadding]);

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
      clusterIconKey: toClusterMarkerImageKey(iconKey),
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
          animationDuration: MAP_CAMERA_ANIMATION_MS,
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
            animationDuration: MAP_CAMERA_ANIMATION_MS,
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
        cameraRef.current?.fitBounds([minLon, minLat], [maxLon, maxLat], padding, MAP_CAMERA_ANIMATION_MS);
      },
      fitToBounds: (bounds, padding = 40, animationDuration = MAP_CAMERA_ANIMATION_MS) => {
        cameraRef.current?.fitBounds(
          [bounds.sw[0], bounds.sw[1]],
          [bounds.ne[0], bounds.ne[1]],
          padding,
          animationDuration
        );
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
          animationDuration: MAP_CAMERA_ANIMATION_MS,
        });
      },
      clearBoundsCache: () => {
        lastBoundsRef.current = null;
      },
    }),
    [initialRegion.zoom]
  );

  if (Platform.OS === 'web' || !isMapboxAvailable) {
    return (
      <View style={styles.unavailableContainer}>
        <MapPin size={36} color={colors.neutral[400]} />
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
        animationDuration: MAP_CAMERA_ANIMATION_MS,
      });
      return;
    }

    const eventId = feature.properties?.id;
    if (eventId) {
      lastMarkerPressAtRef.current = Date.now();
      onFeaturePress(String(eventId));
    }
  };

  return (
    <View
      style={styles.container}
      onTouchStart={(event) => {
        const { pageX, pageY } = event.nativeEvent;
        touchStartPosRef.current = { x: pageX, y: pageY };
        userTouchDragRef.current = false;
        onUserMapGestureStart?.();
      }}
      onTouchMove={(event) => {
        const { pageX, pageY } = event.nativeEvent;
        const dx = pageX - touchStartPosRef.current.x;
        const dy = pageY - touchStartPosRef.current.y;
        if (Math.hypot(dx, dy) < TOUCH_DRAG_THRESHOLD_PX) return;
        userTouchDragRef.current = true;
        pendingUserInteractionRef.current = true;
      }}
      onTouchEnd={() => {
        userTouchDragRef.current = false;
      }}
      onTouchCancel={() => {
        userTouchDragRef.current = false;
      }}
    >
      <Mapbox.MapView
        ref={mapViewRef}
        style={styles.map}
        styleURL={styleURL || Mapbox.StyleURL.Street}
        onDidFinishLoadingMap={() => {
          onMapReady?.();
        }}
        onPress={(feature) => {
          if (Date.now() - lastMarkerPressAtRef.current < 500) {
            return;
          }
          const properties = feature.properties as Record<string, unknown> | undefined;
          const hitEventMarker = Boolean(
            properties?.id || properties?.cluster || properties?.point_count != null
          );
          if (!hitEventMarker) {
            onMapBackgroundPress?.();
          }
        }}
        onRegionWillChange={(feature) => {
          if (feature.properties?.isUserInteraction) {
            markUserMapGesture();
          }
        }}
        onMapIdle={async (event) => {
          const zoomLevel = (event.properties as any)?.zoomLevel ?? (event.properties as any)?.zoom;
          if (onZoomChange && typeof zoomLevel === 'number') {
            onZoomChange(zoomLevel);
          }
          const isUserInteraction = resolveUserInteraction(event);
          pendingUserInteractionRef.current = false;
          userTouchDragRef.current = false;
          await emitVisibleBounds({ isUserInteraction });
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

        {groupedEventSources.map(({ sourceId, iconKey, clusterIconKey, shape }) => (
          <Mapbox.ShapeSource
            key={sourceId}
            id={sourceId}
            ref={(sourceRef) => setShapeSourceRef(sourceId, sourceRef)}
            shape={shape}
            cluster
            clusterRadius={42}
            clusterMaxZoomLevel={15}
            onPress={(pressEvent) => {
              void handlePress(pressEvent, sourceId);
            }}
          >
            <Mapbox.SymbolLayer
              id={`${sourceId}-cluster-icon`}
              filter={['has', 'point_count']}
              style={{
                iconImage: clusterIconKey || DEFAULT_CLUSTER_MAP_MARKER,
                iconSize: ['step', ['get', 'point_count'], 1, 10, 1.08, 25, 1.16],
                iconAllowOverlap: true,
                iconIgnorePlacement: true,
                iconAnchor: 'center',
              }}
            />
            <Mapbox.SymbolLayer
              id={`${sourceId}-cluster-count`}
              filter={['has', 'point_count']}
              style={{
                textField: ['to-string', ['get', 'point_count']],
                textSize: ['step', ['get', 'point_count'], 12, 10, 11, 25, 10, 100, 9],
                textColor: colors.neutral[0],
                textHaloColor: 'rgba(15, 23, 25, 0.45)',
                textHaloWidth: 0.6,
                textAnchor: 'center',
                textOffset: [0, 0],
                textAllowOverlap: true,
                textIgnorePlacement: true,
              }}
            />
            <Mapbox.SymbolLayer
              id={`${sourceId}-event-markers`}
              filter={['!', ['has', 'point_count']]}
              style={{
                iconImage: iconKey || DEFAULT_MAP_MARKER,
                iconSize: 1,
                iconAllowOverlap: true,
                iconIgnorePlacement: true,
              }}
            />
          </Mapbox.ShapeSource>
        ))}

        <Mapbox.ShapeSource id="selected-event-source" shape={selectedEventShape}>
          <Mapbox.CircleLayer
            id="selected-event-halo"
            filter={['!', ['has', 'point_count']]}
            style={{
              circleRadius: 26,
              circleColor: colors.primary[500],
              circleOpacity: 0.24,
              circleStrokeWidth: 3,
              circleStrokeColor: colors.primary[400],
              circleStrokeOpacity: 0.95,
            }}
          />
          <Mapbox.SymbolLayer
            id="selected-event-marker"
            filter={['!', ['has', 'point_count']]}
            style={{
              iconImage: selectedMarkerIconKey,
              iconSize: selectedIconSize,
              iconAllowOverlap: true,
              iconIgnorePlacement: true,
            }}
          />
        </Mapbox.ShapeSource>

        {children}
      </Mapbox.MapView>
    </View>
  );
});
MapWrapper.displayName = 'MapWrapper';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    zIndex: 0,
    elevation: 0,
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
    color: colors.neutral[700],
  },
  unavailableText: {
    fontSize: 14,
    textAlign: 'center',
    color: colors.neutral[600],
  },
});
