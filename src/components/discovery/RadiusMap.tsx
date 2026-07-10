import React, { useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import Constants from 'expo-constants';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import type { DiscoveryPlace } from '@/types/discovery.types';

Mapbox.setAccessToken(Constants.expoConfig?.extra?.mapboxToken || process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');

type Props = {
  places: DiscoveryPlace[];
  center?: { latitude: number; longitude: number } | null;
};

export function RadiusMap({ places, center }: Props) {
  const cameraCenter = useMemo(() => {
    if (center) return [center.longitude, center.latitude] as [number, number];
    if (places.length > 0) {
      return [places[0].centroid_longitude, places[0].centroid_latitude] as [number, number];
    }
    return [4.8357, 45.764] as [number, number];
  }, [center, places]);

  const featureCollection = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: places.map((place) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [place.centroid_longitude, place.centroid_latitude],
        },
        properties: {
          id: place.id,
          label: place.label ?? 'Lieu',
        },
      })),
    }),
    [places],
  );

  if (places.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Aucun lieu repéré pour le moment.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Mapbox.MapView style={styles.map} styleURL={Mapbox.StyleURL.Street} compassEnabled={false}>
        <Mapbox.Camera zoomLevel={11} centerCoordinate={cameraCenter} animationDuration={0} />
        <Mapbox.ShapeSource id="discovery-places" shape={featureCollection}>
          <Mapbox.CircleLayer
            id="discovery-places-circles"
            style={{
              circleRadius: 10,
              circleColor: colors.brand.secondary,
              circleOpacity: 0.85,
              circleStrokeWidth: 2,
              circleStrokeColor: colors.brand.text,
            }}
          />
        </Mapbox.ShapeSource>
      </Mapbox.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 260,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  map: {
    flex: 1,
  },
  empty: {
    height: 160,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: spacing.md,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
});
