import React, { useRef, forwardRef, useImperativeHandle, useCallback, useMemo, useState, useEffect, memo } from 'react';
import { Motion } from '@/constants/motion';
import { StyleSheet, View, Text, Platform } from 'react-native';
import Mapbox, { type MapState } from '@rnmapbox/maps';
import { MapPin } from 'lucide-react-native';
import { colors } from '../../constants/theme';
import Constants from 'expo-constants';
import type { FeatureCollection } from 'geojson';
import {
  DEFAULT_CLUSTER_MAP_MARKER,
  DEFAULT_MAP_MARKER,
} from '../../constants/category-visuals';
import { CategoryMarkerImages, useCategoryMarkerVisuals } from './CategoryMarkerImages';
import {
  groupMapMarkerFeaturesByIcon,
  normalizeMapMarkerIconKey,
} from '../../utils/map-marker-features';
import { MAP_CAMERA_ANIMATION_MS } from '../../utils/map-sheet-layout';
import { insetMapBoundsForBottomOverlay } from '../../utils/map-viewport-fetch-utils';
import { consumeBooleanFlag } from '@/utils/map-interaction-token';

Mapbox.setAccessToken(Constants.expoConfig?.extra?.mapboxToken || process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');
Mapbox.setTelemetryEnabled(false);

const EMPTY_FEATURE_COLLECTION: FeatureCollection = { type: 'FeatureCollection', features: [] };

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
  maxBounds?: { sw: readonly [number, number]; ne: readonly [number, number] };
  /** Sheet (or peek) height covering the bottom of the MapView, in px. */
  bottomOverlayPx?: number;
}

export type MapCameraSnapshot = {
  longitude: number;
  latitude: number;
  zoom: number;
};

export type MapWrapperHandle = {
  recenter: (options: { longitude: number; latitude: number; zoom?: number }) => void;
  getCameraSnapshot: () => MapCameraSnapshot | null;
  restoreCameraSnapshot: (
    snapshot: MapCameraSnapshot,
    options?: { animationDuration?: number },
  ) => void;
  setShape: (fc: FeatureCollection) => void;
  fitToCoordinates: (coordinates: { longitude: number; latitude: number }[], padding?: number | number[]) => void;
  fitToBounds: (
    bounds: { ne: [number, number]; sw: [number, number] },
    padding?: number | number[],
    animationDuration?: number
  ) => void;
  getVisibleBounds: () => Promise<{ ne: [number, number]; sw: [number, number] } | null>;
  getRawVisibleBounds: () => Promise<{ ne: [number, number]; sw: [number, number] } | null>;
  getCachedRawVisibleBounds: () => { ne: [number, number]; sw: [number, number] } | null;
  focusOnCoordinate: (options: {
    longitude: number;
    latitude: number;
    zoom?: number;
    paddingBottom?: number;
  }) => void;
  clearBoundsCache: () => void;
  resetCameraPadding: () => void;
};

const MapWrapperInner = forwardRef<MapWrapperHandle, MapWrapperProps>(
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
      maxBounds,
      bottomOverlayPx = 0,
    },
    ref
  ) => {
  const isMapboxAvailable = !!Mapbox.MapView;
  const categoryMarkerVisuals = useCategoryMarkerVisuals();
  const mapViewRef = useRef<Mapbox.MapView>(null);
  const shapeSourceRefs = useRef<Record<string, any>>({});
  const cameraRef = useRef<Mapbox.Camera>(null);
  const lastBoundsRef = useRef<{ sw: [number, number]; ne: [number, number] } | null>(null);
  const lastRawBoundsRef = useRef<{ sw: [number, number]; ne: [number, number] } | null>(null);
  const lastCameraSnapshotRef = useRef({
    longitude: initialRegion.longitude,
    latitude: initialRegion.latitude,
    zoom: initialRegion.zoom,
  });
  const mapHeightPxRef = useRef(0);
  const bottomOverlayPxRef = useRef(bottomOverlayPx);
  bottomOverlayPxRef.current = bottomOverlayPx;
  const pendingUserInteractionRef = useRef(false);
  const userTouchDragRef = useRef(false);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const suppressNextBackgroundPressRef = useRef(false);
  const [eventsShape, setEventsShape] = useState<FeatureCollection>(EMPTY_FEATURE_COLLECTION);
  const [styleReady, setStyleReady] = useState(false);

  // Style reload (standard ↔ satellite) remounts native layers — wait before attaching ours.
  useEffect(() => {
    setStyleReady(false);
  }, [styleURL]);

  const TOUCH_DRAG_THRESHOLD_PX = 8;

  const markUserMapGesture = useCallback(() => {
    const wasPending = pendingUserInteractionRef.current;
    pendingUserInteractionRef.current = true;
    if (!wasPending) {
      onUserMapGestureStart?.();
    }
  }, [onUserMapGestureStart]);

  const resolveUserInteraction = useCallback((state?: MapState) => {
    const legacyProps = state?.properties as Record<string, unknown> | undefined;
    return (
      pendingUserInteractionRef.current ||
      userTouchDragRef.current ||
      state?.gestures?.isGestureActive === true ||
      legacyProps?.isUserInteraction === true
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

  const insetVisibleBounds = useCallback(
    (raw: { sw: [number, number]; ne: [number, number] }) =>
      insetMapBoundsForBottomOverlay(raw, {
        mapHeightPx: mapHeightPxRef.current,
        overlayBottomPx: bottomOverlayPxRef.current,
      }),
    []
  );

  const emitVisibleBounds = useCallback(
    async (meta?: { isUserInteraction: boolean }) => {
      if (!mapViewRef.current) return;
      try {
        const bounds = await mapViewRef.current.getVisibleBounds();
        if (Array.isArray(bounds) && bounds.length === 2) {
          const raw = { sw: bounds[0] as [number, number], ne: bounds[1] as [number, number] };
          lastRawBoundsRef.current = raw;
          const next = insetVisibleBounds(raw);
          if (hasBoundsChanged(next)) {
            lastBoundsRef.current = next;
            onVisibleBoundsChange?.(next, meta);
          } else if (meta?.isUserInteraction) {
            onVisibleBoundsChange?.(next, meta);
          } else if (meta && !meta.isUserInteraction) {
            // Programmatic camera settled on unchanged bbox — still notify so
            // refreshAfter / first-open bootstrap can complete.
            onVisibleBoundsChange?.(next, meta);
          }
        }
      } catch (e) {
        console.warn('getVisibleBounds failed', e);
      }
    },
    [insetVisibleBounds, onVisibleBoundsChange]
  );

  // Overlay height is query inset only (getVisibleBounds). Do not re-emit bounds
  // here: that overwrote the camera target with already-inset coordinates.

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
    return normalizeMapMarkerIconKey((feature.properties as Record<string, unknown> | null)?.icon);
  }, [selectedEventShape]);

  /** Hide the base pin while the enlarged selected overlay is shown (avoids visual double). */
  const unselectedEventMarkerFilter = useMemo(
    () =>
      activeEventId
        ? ([
            'all',
            ['!', ['has', 'point_count']],
            ['!=', ['to-string', ['get', 'id']], String(activeEventId)],
          ] as const)
        : (['!', ['has', 'point_count']] as const),
    [activeEventId]
  );

  useEffect(() => {
    if (!mapPadding) return;
    cameraRef.current?.setCamera({
      padding: toCameraPadding(mapPadding),
      animationDuration: MAP_CAMERA_ANIMATION_MS,
    });
  }, [mapPadding]);

  const groupedEventSources = useMemo(
    () => groupMapMarkerFeaturesByIcon(eventsShape.features || []),
    [eventsShape],
  );

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
      getCameraSnapshot: () => ({ ...lastCameraSnapshotRef.current }),
      restoreCameraSnapshot: (
        { longitude, latitude, zoom: zoomLevel },
        options,
      ) => {
        lastCameraSnapshotRef.current = {
          longitude,
          latitude,
          zoom: zoomLevel,
        };
        cameraRef.current?.setCamera({
          centerCoordinate: [longitude, latitude],
          zoomLevel,
          padding: toCameraPadding(mapPadding),
          animationDuration:
            options?.animationDuration ?? MAP_CAMERA_ANIMATION_MS,
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
            const raw = { sw: bounds[0] as [number, number], ne: bounds[1] as [number, number] };
            lastRawBoundsRef.current = raw;
            return insetVisibleBounds(raw);
          }
        } catch (e) {
          console.warn('getVisibleBounds failed', e);
        }
        return null;
      },
      getCachedRawVisibleBounds: () => {
        const raw = lastRawBoundsRef.current;
        if (!raw) return null;
        return {
          sw: [raw.sw[0], raw.sw[1]],
          ne: [raw.ne[0], raw.ne[1]],
        };
      },
      getRawVisibleBounds: async () => {
        const cached = lastRawBoundsRef.current;
        if (cached) {
          return {
            sw: [cached.sw[0], cached.sw[1]],
            ne: [cached.ne[0], cached.ne[1]],
          };
        }
        if (!mapViewRef.current) return null;
        try {
          const bounds = await mapViewRef.current.getVisibleBounds();
          if (Array.isArray(bounds) && bounds.length === 2) {
            const raw = {
              sw: bounds[0] as [number, number],
              ne: bounds[1] as [number, number],
            };
            lastRawBoundsRef.current = raw;
            return raw;
          }
        } catch (e) {
          console.warn('getRawVisibleBounds failed', e);
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
      resetCameraPadding: () => {
        cameraRef.current?.setCamera({
          padding: toCameraPadding(mapPadding),
          animationDuration: MAP_CAMERA_ANIMATION_MS,
        });
      },
    }),
    [initialRegion.zoom, insetVisibleBounds, mapPadding]
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
      suppressNextBackgroundPressRef.current = true;
      onFeaturePress(String(eventId));
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          suppressNextBackgroundPressRef.current = false;
        });
      });
    }
  };

  return (
    <View
      style={styles.container}
      onLayout={(event) => {
        const height = event.nativeEvent.layout.height;
        const previous = mapHeightPxRef.current;
        mapHeightPxRef.current = height;
        if (previous === height || !lastRawBoundsRef.current) return;
        const next = insetVisibleBounds(lastRawBoundsRef.current);
        if (!hasBoundsChanged(next)) return;
        lastBoundsRef.current = next;
        onVisibleBoundsChange?.(next, { isUserInteraction: false });
      }}
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
        onWillStartLoadingMap={() => {
          setStyleReady(false);
        }}
        onDidFinishLoadingStyle={() => {
          setStyleReady(true);
        }}
        onDidFinishLoadingMap={() => {
          setStyleReady(true);
          onMapReady?.();
        }}
        onPress={(feature) => {
          if (consumeBooleanFlag(suppressNextBackgroundPressRef)) {
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
        onCameraChanged={(state) => {
          const center = state.properties?.center;
          const zoomLevel = state.properties?.zoom;
          if (
            Array.isArray(center) &&
            center.length >= 2 &&
            typeof center[0] === 'number' &&
            typeof center[1] === 'number' &&
            typeof zoomLevel === 'number'
          ) {
            lastCameraSnapshotRef.current = {
              longitude: center[0],
              latitude: center[1],
              zoom: zoomLevel,
            };
          }
          if (state.gestures?.isGestureActive) {
            markUserMapGesture();
          }
        }}
        onMapIdle={async (state) => {
          const zoomLevel = state.properties?.zoom;
          if (onZoomChange && typeof zoomLevel === 'number') {
            onZoomChange(zoomLevel);
          }
          const isUserInteraction = resolveUserInteraction(state);
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
          maxBounds={maxBounds ? { sw: [...maxBounds.sw], ne: [...maxBounds.ne] } : undefined}
        />

        <Mapbox.LocationPuck
          visible={Boolean(userLocation)}
          puckBearing="heading"
          puckBearingEnabled
        />

        {styleReady
          ? groupedEventSources.map(({ sourceId, iconKey, clusterIconKey, shape }) => (
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
                  filter={unselectedEventMarkerFilter as any}
                  style={{
                    iconImage: iconKey || DEFAULT_MAP_MARKER,
                    iconSize: 1,
                    iconAllowOverlap: true,
                    iconIgnorePlacement: true,
                    iconAnchor: 'bottom',
                    iconOffset: [0, 2],
                  }}
                />
              </Mapbox.ShapeSource>
            ))
          : null}

        {styleReady ? (
        <Mapbox.ShapeSource id="selected-event-source" shape={selectedEventShape}>
          <Mapbox.SymbolLayer
            id="selected-event-marker"
            filter={['!', ['has', 'point_count']]}
            style={{
              iconImage: selectedMarkerIconKey,
              iconSize: 1.45 * Motion.transform.markerSelectedScale,
              iconAllowOverlap: true,
              iconIgnorePlacement: true,
              iconAnchor: 'bottom',
              iconOffset: [0, 2],
            }}
          />
        </Mapbox.ShapeSource>
        ) : null}

        {children}
      </Mapbox.MapView>
    </View>
  );
});
MapWrapperInner.displayName = 'MapWrapper';

export const MapWrapper = memo(MapWrapperInner);

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
