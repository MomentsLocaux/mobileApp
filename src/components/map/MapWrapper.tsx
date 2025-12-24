import React, { useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { MapPin } from 'lucide-react-native';
import { colors } from '../../constants/theme';
import Constants from 'expo-constants';
import type { FeatureCollection } from 'geojson';

Mapbox.setAccessToken(Constants.expoConfig?.extra?.mapboxToken || process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');
Mapbox.setTelemetryEnabled(false);

interface MapWrapperProps {
  initialRegion: {
    latitude: number;
    longitude: number;
    zoom: number;
  };
  userLocation?: { latitude: number; longitude: number } | null;
  onFeaturePress: (featureId: string) => void;
  onClusterPress?: (features: string[]) => void;
  onZoomChange?: (zoom: number) => void;
  onVisibleBoundsChange?: (bounds: { ne: [number, number]; sw: [number, number] }) => void;
  children?: React.ReactNode;
  styleURL?: string;
}

export type MapWrapperHandle = {
  recenter: (options: { longitude: number; latitude: number; zoom?: number }) => void;
  setShape: (fc: FeatureCollection) => void;
  fitToCoordinates: (coordinates: { longitude: number; latitude: number }[], padding?: number) => void;
};

export const MapWrapper = forwardRef<MapWrapperHandle, MapWrapperProps>(
  (
    {
      initialRegion,
      userLocation,
      onFeaturePress,
      onClusterPress,
      onZoomChange,
      onVisibleBoundsChange,
      children,
      styleURL,
    },
    ref
  ) => {
  const isMapboxAvailable = !!Mapbox.MapView;
  const shapeSourceRef = useRef<Mapbox.ShapeSource>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [shape, setShapeState] = useState<FeatureCollection>({ type: 'FeatureCollection', features: [] });

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
        setShapeState(fc);
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

  const handlePress = async (event: Mapbox.OnPressEvent) => {
    const feature = event.features?.[0];
    if (!feature) return;

    const isCluster = feature.properties?.cluster;
    const coords = (feature.geometry as any)?.coordinates;

    if (isCluster && shapeSourceRef.current && coords) {
      // Centrer sur les bornes réelles du cluster
      if (onClusterPress) {
        try {
          const leaves: any = await shapeSourceRef.current.getClusterLeaves(feature as any, 200, 0);
          const leafFeatures = Array.isArray(leaves?.features)
            ? leaves.features
            : Array.isArray(leaves)
            ? leaves
            : [];

          const coordsInCluster = leafFeatures
            .map((f: any) => (Array.isArray(f?.geometry?.coordinates) ? f.geometry.coordinates : null))
            .filter((c: any) => Array.isArray(c) && c.length === 2) as number[][];

          if (coordsInCluster.length > 0) {
            let minLat = 90,
              maxLat = -90,
              minLon = 180,
              maxLon = -180;
            coordsInCluster.forEach((c) => {
              const [lon, lat] = c;
              if (lat < minLat) minLat = lat;
              if (lat > maxLat) maxLat = lat;
              if (lon < minLon) minLon = lon;
              if (lon > maxLon) maxLon = lon;
            });
            cameraRef.current?.fitBounds([minLon, minLat], [maxLon, maxLat], 60, 300);
          }

          const idsInCluster = leafFeatures
            .map((f: any) => (f?.properties?.id != null ? String(f.properties.id) : ''))
            .filter(Boolean);
          onClusterPress(idsInCluster);
        } catch (e) {
          console.warn('Cluster leaves error', e);
          onClusterPress([]);
        }
      }
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
            pitch: 0,
            heading: 0,
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
          shape={shape}
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
              circleColor: colors.primary[600],
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
