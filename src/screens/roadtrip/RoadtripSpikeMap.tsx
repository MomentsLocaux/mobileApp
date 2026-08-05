import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import Constants from 'expo-constants';
import type { Feature, FeatureCollection } from 'geojson';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import type { RoadtripCandidate, RoadtripRoute, RoadtripWaypoint } from './roadtrip.types';

Mapbox.setAccessToken(Constants.expoConfig?.extra?.mapboxToken || process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');

type Props = {
  route: RoadtripRoute | null;
  waypoints: RoadtripWaypoint[];
  candidates: RoadtripCandidate[];
  selectedEventId?: string | null;
  onCandidatePress?: (eventId: string) => void;
};

export function RoadtripSpikeMap({ route, waypoints, candidates, selectedEventId, onCandidatePress }: Props) {
  const cameraRef = useRef<Mapbox.Camera>(null);

  const routeShape = useMemo<FeatureCollection>(() => {
    const features: Feature[] = (route?.legs ?? []).map((leg) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: leg.geometry },
      properties: { legIndex: leg.index },
    }));
    return { type: 'FeatureCollection', features };
  }, [route]);

  const waypointShape = useMemo<FeatureCollection>(() => {
    const features: Feature[] = waypoints.map((waypoint, index) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [waypoint.coordinate.longitude, waypoint.coordinate.latitude],
      },
      properties: { label: waypoint.label, kind: waypoint.kind, order: index + 1 },
    }));
    return { type: 'FeatureCollection', features };
  }, [waypoints]);

  const candidateShape = useMemo<FeatureCollection>(() => {
    const features: Feature[] = candidates.map((candidate) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [candidate.event.longitude, candidate.event.latitude],
      },
      properties: {
        id: candidate.event.id,
        selected: candidate.event.id === selectedEventId,
      },
    }));
    return { type: 'FeatureCollection', features };
  }, [candidates, selectedEventId]);

  const bounds = useMemo(() => {
    const positions = (route?.legs ?? []).flatMap((leg) => leg.geometry);
    if (positions.length === 0) return null;
    let minLon = Infinity;
    let maxLon = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const [lon, lat] of positions) {
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
    return { sw: [minLon, minLat] as [number, number], ne: [maxLon, maxLat] as [number, number] };
  }, [route]);

  useEffect(() => {
    if (!bounds) return;
    cameraRef.current?.fitBounds(bounds.sw, bounds.ne, 48, 600);
  }, [bounds]);

  if (Platform.OS === 'web' || !Mapbox.MapView) {
    return (
      <View style={styles.unavailable}>
        <Text style={styles.unavailableText}>Carte disponible uniquement sur iOS/Android (client dev).</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Mapbox.MapView style={styles.map} styleURL={Mapbox.StyleURL.Street} compassEnabled={false}>
        <Mapbox.Camera
          ref={cameraRef}
          defaultSettings={{ centerCoordinate: [2.6, 47.5], zoomLevel: 4.6 }}
        />

        <Mapbox.ShapeSource id="roadtrip-route" shape={routeShape}>
          <Mapbox.LineLayer
            id="roadtrip-route-casing"
            style={{ lineColor: colors.neutral[0], lineWidth: 6, lineOpacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
          />
          <Mapbox.LineLayer
            id="roadtrip-route-line"
            style={{ lineColor: colors.brand.primary, lineWidth: 3.5, lineCap: 'round', lineJoin: 'round' }}
          />
        </Mapbox.ShapeSource>

        <Mapbox.ShapeSource
          id="roadtrip-candidates"
          shape={candidateShape}
          onPress={(event) => {
            const id = event.features?.[0]?.properties?.id;
            if (typeof id === 'string') onCandidatePress?.(id);
          }}
        >
          <Mapbox.CircleLayer
            id="roadtrip-candidate-dots"
            style={{
              circleRadius: ['case', ['get', 'selected'], 10, 7],
              circleColor: colors.brand.secondary,
              circleOpacity: ['case', ['get', 'selected'], 1, 0.85],
              circleStrokeWidth: 2,
              circleStrokeColor: colors.neutral[0],
            }}
          />
        </Mapbox.ShapeSource>

        <Mapbox.ShapeSource id="roadtrip-waypoints" shape={waypointShape}>
          <Mapbox.CircleLayer
            id="roadtrip-waypoint-dots"
            style={{
              circleRadius: 9,
              circleColor: colors.neutral[950],
              circleStrokeWidth: 2.5,
              circleStrokeColor: colors.neutral[0],
            }}
          />
          <Mapbox.SymbolLayer
            id="roadtrip-waypoint-order"
            style={{
              textField: ['to-string', ['get', 'order']],
              textSize: 11,
              textColor: colors.neutral[0],
              textAllowOverlap: true,
              textIgnorePlacement: true,
            }}
          />
        </Mapbox.ShapeSource>
      </Mapbox.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 300,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  map: { flex: 1 },
  unavailable: {
    height: 300,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[100],
    padding: spacing.md,
  },
  unavailableText: {
    ...typography.caption,
    color: colors.neutral[500],
    textAlign: 'center',
  },
});
