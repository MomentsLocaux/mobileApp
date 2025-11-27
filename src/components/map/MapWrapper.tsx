import React from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { MapPin } from 'lucide-react-native';
import type { EventWithCreator } from '../../types/database';
import { colors, borderRadius } from '../../constants/theme';
import Constants from 'expo-constants';

Mapbox.setAccessToken(Constants.expoConfig?.extra?.mapboxToken || process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');
Mapbox.setTelemetryEnabled(false);

interface MapWrapperProps {
  events: EventWithCreator[];
  initialRegion: {
    latitude: number;
    longitude: number;
    zoom: number;
  };
  onMarkerPress: (event: EventWithCreator) => void;
  onClusterPress?: (events: EventWithCreator[]) => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  children?: React.ReactNode;
}

export function MapWrapper({
  events,
  initialRegion,
  onMarkerPress,
  zoom,
  onZoomChange,
  children,
}: MapWrapperProps) {
  const isMapboxAvailable = !!Mapbox.MapView;

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

  const getMarkerColor = (event: EventWithCreator) => {
    if (event.interests_count > 50) return colors.error[500];
    if (event.interests_count > 20) return colors.warning[500];
    return colors.primary[600];
  };

  return (
    <View style={styles.container}>
      <Mapbox.MapView
        style={styles.map}
        styleURL={Mapbox.StyleURL.Street}
        onMapIdle={(event) => {
          const zoomLevel = (event.properties as any).zoomLevel ?? (event.properties as any).zoom;
          if (onZoomChange && typeof zoomLevel === 'number') {
            onZoomChange(zoomLevel);
          }
        }}
      >
        <Mapbox.Camera
          zoomLevel={zoom ?? initialRegion.zoom}
          centerCoordinate={[initialRegion.longitude, initialRegion.latitude]}
        />

        <Mapbox.UserLocation visible={true} />

        {events.map((event) => (
          <Mapbox.MarkerView
            key={event.id}
            coordinate={[event.longitude, event.latitude]}
            anchor={{ x: 0.5, y: 0.5 }}
            allowOverlap
            onPress={() => onMarkerPress(event)}
          >
            <View
              style={[
                styles.marker,
                { backgroundColor: getMarkerColor(event) },
              ]}
            >
              <MapPin size={20} color={colors.neutral[0]} />
            </View>
          </Mapbox.MarkerView>
        ))}
        {children}
      </Mapbox.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  marker: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.neutral[0],
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
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
