import React, { useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { MapPin } from 'lucide-react-native';
import type { EventWithCreator } from '../../types/database';
import { colors } from '../../constants/theme';
import Constants from 'expo-constants';
import type { Feature, FeatureCollection } from 'geojson';

Mapbox.setAccessToken(Constants.expoConfig?.extra?.mapboxToken || process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');
Mapbox.setTelemetryEnabled(false);

interface MapWrapperProps {
  events: EventWithCreator[];
  initialRegion: {
    latitude: number;
    longitude: number;
    zoom: number;
  };
  userLocation?: { latitude: number; longitude: number } | null;
  onMarkerPress: (event: EventWithCreator) => void;
  onClusterPress?: (events: EventWithCreator[]) => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  onVisibleBoundsChange?: (bounds: { ne: [number, number]; sw: [number, number] }) => void;
  children?: React.ReactNode;
  styleURL?: string;
  pitch?: number;
  bearing?: number;
}

export type MapWrapperHandle = {
  recenter: (options: { longitude: number; latitude: number; zoom?: number }) => void;
  fitToEvents: (events: EventWithCreator[], padding?: number) => void;
};

export const MapWrapper = forwardRef<MapWrapperHandle, MapWrapperProps>(
  (
    {
      events,
      initialRegion,
      userLocation,
      onMarkerPress,
      onClusterPress,
      zoom,
      onZoomChange,
      onVisibleBoundsChange,
      children,
      styleURL,
      pitch,
      bearing,
    },
    ref
  ) => {
  const isMapboxAvailable = !!Mapbox.MapView;
  const shapeSourceRef = useRef<Mapbox.ShapeSource>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);

  console.log('[MapWrapper] initialRegion=', initialRegion, 'events=', events.length);

  useImperativeHandle(
    ref,
    () => ({
      recenter: ({ longitude, latitude, zoom: zoomLevel }) => {
        cameraRef.current?.setCamera({
          centerCoordinate: [longitude, latitude],
          zoomLevel: zoomLevel ?? zoom ?? initialRegion.zoom,
          animationDuration: 300,
        });
      },
      fitToEvents: (evts, padding = 40) => {
        if (!evts || evts.length === 0) return;
        if (evts.length === 1) {
          const e = evts[0];
          const coords =
            Array.isArray(e?.location?.coordinates) && e.location.coordinates.length === 2
              ? { longitude: e.location.coordinates[0], latitude: e.location.coordinates[1] }
              : { longitude: e.longitude, latitude: e.latitude };
          cameraRef.current?.setCamera({
            centerCoordinate: [coords.longitude, coords.latitude],
            zoomLevel: 12,
            animationDuration: 300,
          });
          return;
        }

        let minLat = 90,
          maxLat = -90,
          minLon = 180,
          maxLon = -180;

        evts.forEach((e) => {
          const coords =
            Array.isArray(e?.location?.coordinates) && e.location.coordinates.length === 2
              ? { longitude: e.location.coordinates[0], latitude: e.location.coordinates[1] }
              : { longitude: e.longitude, latitude: e.latitude };
          if (coords.latitude < minLat) minLat = coords.latitude;
          if (coords.latitude > maxLat) maxLat = coords.latitude;
          if (coords.longitude < minLon) minLon = coords.longitude;
          if (coords.longitude > maxLon) maxLon = coords.longitude;
        });

        cameraRef.current?.fitBounds(
          [minLon, minLat],
          [maxLon, maxLat],
          padding,
          300
        );
      },
    }),
    [initialRegion.zoom, zoom]
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

  const featureCollection = useMemo<FeatureCollection>(() => {
    const features: Feature[] = events
      .map((event) => {
        const coords =
          Array.isArray(event?.location?.coordinates) && event.location.coordinates.length === 2
            ? event.location.coordinates
            : [event.longitude, event.latitude];

        if (!coords || coords.some((c) => typeof c !== 'number')) return null;

        console.log('[MapWrapper] render event marker', event.id, 'coords=', coords);
        return {
          type: 'Feature',
          id: String(event.id),
          properties: {
            id: event.id,
            interests_count: event.interests_count ?? 0,
          },
          geometry: {
            type: 'Point',
            coordinates: [coords[0], coords[1]],
          },
        } as Feature;
      })
      .filter(Boolean) as Feature[];

    return { type: 'FeatureCollection', features };
  }, [events]);

  const iconColorExpression = [
    'step',
    ['get', 'interests_count'],
    colors.primary[600],
    20,
    colors.warning[500],
    50,
    colors.error[500],
  ];

  const handlePress = async (event: Mapbox.OnPressEvent) => {
    const feature = event.features?.[0];
    if (!feature) return;

    const isCluster = feature.properties?.cluster;
    const coords = (feature.geometry as any)?.coordinates;

    if (isCluster && shapeSourceRef.current && coords) {
      const targetZoom = Math.min(16, (zoom ?? initialRegion.zoom ?? 12) + 2);
      cameraRef.current?.setCamera({
        centerCoordinate: coords,
        zoomLevel: targetZoom,
        animationDuration: 300,
      });
      if (onClusterPress) {
        try {
          const leaves: any = await shapeSourceRef.current.getClusterLeaves(feature as any, 200, 0);
          const leafFeatures = Array.isArray(leaves?.features)
            ? leaves.features
            : Array.isArray(leaves)
            ? leaves
            : [];

          const idsInCluster = leafFeatures
            .map((f: any) => (f?.properties?.id != null ? String(f.properties.id) : ''))
            .filter(Boolean);
          const clusterEvents = events.filter((e) => idsInCluster.includes(String(e.id)));
          onClusterPress(clusterEvents.length ? clusterEvents : events);
        } catch (e) {
          console.warn('Cluster leaves error', e);
          onClusterPress(events);
        }
      }
      return;
    }

    const eventId = feature.properties?.id;
    if (eventId) {
      const selected = events.find((e) => e.id === eventId);
      if (selected) {
        onMarkerPress(selected);
      }
    }
  };

  useEffect(() => {
    if (typeof pitch === 'number') {
      cameraRef.current?.setCamera({
        pitch,
        animationDuration: 250,
      });
    }
  }, [pitch]);

  useEffect(() => {
    if (typeof bearing === 'number') {
      cameraRef.current?.setCamera({
        heading: bearing,
        animationDuration: 250,
      });
    }
  }, [bearing]);

  return (
    <View style={styles.container}>
      <Mapbox.MapView
        style={styles.map}
        styleURL={styleURL || Mapbox.StyleURL.Street}
        onMapIdle={(event) => {
          const zoomLevel = (event.properties as any).zoomLevel ?? (event.properties as any).zoom;
          if (onZoomChange && typeof zoomLevel === 'number') {
            onZoomChange(zoomLevel);
          }
          const bounds = (event.properties as any)?.bounds;
          if (
            bounds &&
            Array.isArray(bounds.ne) &&
            Array.isArray(bounds.sw) &&
            bounds.ne.length === 2 &&
            bounds.sw.length === 2
          ) {
            onVisibleBoundsChange?.({ ne: bounds.ne as [number, number], sw: bounds.sw as [number, number] });
          }
        }}
      >
        <Mapbox.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [initialRegion.longitude, initialRegion.latitude],
            zoomLevel: initialRegion.zoom,
            pitch: pitch ?? 0,
            heading: bearing ?? 0,
          }}
        />

        <Mapbox.UserLocation visible={true} showsUserHeadingIndicator={true} />

        {userLocation && (
          <Mapbox.ShapeSource
            id="user-location"
            shape={{
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [userLocation.longitude, userLocation.latitude] },
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

        <Mapbox.ShapeSource
          id="events-source"
          ref={shapeSourceRef}
          shape={featureCollection}
          cluster
          clusterRadius={50}
          clusterMaxZoom={14}
          onPress={handlePress}
        >
          <Mapbox.CircleLayer
            id="clusters"
            filter={['has', 'point_count']}
            style={{
              circleColor: ['step', ['get', 'point_count'], '#51bbd6', 10, '#f1f075', 30, '#f28cb1'],
              circleRadius: ['step', ['get', 'point_count'], 15, 10, 20, 30, 25],
              circleOpacity: 0.9,
            }}
          />

          <Mapbox.SymbolLayer
            id="cluster-count"
            filter={['has', 'point_count']}
            style={{
              textField: ['get', 'point_count_abbreviated'],
              textSize: 12,
              textColor: '#000',
              textFont: ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            }}
          />

          <Mapbox.CircleLayer
            id="event-pins-halo"
            filter={['!', ['has', 'point_count']]}
            style={{
              circleColor: colors.neutral[0],
              circleRadius: 9,
              circleOpacity: 0.9,
              circleStrokeWidth: 0,
            }}
          />
          <Mapbox.CircleLayer
            id="event-pins"
            filter={['!', ['has', 'point_count']]}
            style={{
              circleColor: iconColorExpression,
              circleRadius: 7,
              circleOpacity: 0.95,
              circleStrokeColor: colors.neutral[0],
              circleStrokeWidth: 2,
            }}
          />
        </Mapbox.ShapeSource>
        {children}
      </Mapbox.MapView>
    </View>
  );
});

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
    color: colors.neutral[700],
  },
  unavailableText: {
    fontSize: 14,
    textAlign: 'center',
    color: colors.neutral[600],
  },
});
