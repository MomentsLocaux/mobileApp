import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import type { EventLocation } from '@/hooks/useCreateEventStore';

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');

type Props = {
  coverUrl?: string;
  title: string;
  dateLabel: string;
  category?: string;
  city?: string;
  location?: EventLocation;
};

function hasValidCoordinates(location?: EventLocation): location is EventLocation {
  return (
    !!location &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude) &&
    !(location.latitude === 0 && location.longitude === 0)
  );
}

export function EventLocationPreviewMap({ location }: { location?: EventLocation }) {
  const pin = hasValidCoordinates(location) ? location : undefined;
  const pinShape = useMemo(
    () =>
      pin
        ? {
            type: 'FeatureCollection' as const,
            features: [
              {
                type: 'Feature' as const,
                id: 'preview-pin',
                geometry: {
                  type: 'Point' as const,
                  coordinates: [pin.longitude, pin.latitude],
                },
                properties: {},
              },
            ],
          }
        : null,
    [pin],
  );

  if (!pin || !pinShape) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.mapPlaceholder]}>
        <Text style={styles.mapPlaceholderText}>Lieu non renseigné</Text>
      </View>
    );
  }

  return (
    <MapboxGL.MapView
      style={StyleSheet.absoluteFill}
      styleURL={MapboxGL.StyleURL.Street}
      scrollEnabled={false}
      zoomEnabled={false}
      pitchEnabled={false}
      rotateEnabled={false}
    >
      <MapboxGL.Camera zoomLevel={13} centerCoordinate={[pin.longitude, pin.latitude]} />
      <MapboxGL.ShapeSource id="preview-pin-source" shape={pinShape}>
        <MapboxGL.CircleLayer
          id="preview-pin-halo"
          style={{
            circleRadius: 14,
            circleColor: 'rgba(124, 181, 24, 0.28)',
          }}
        />
        <MapboxGL.CircleLayer
          id="preview-pin-dot"
          style={{
            circleRadius: 7,
            circleColor: colors.brand.secondary,
            circleStrokeWidth: 3,
            circleStrokeColor: colors.brand.surface,
          }}
        />
      </MapboxGL.ShapeSource>
    </MapboxGL.MapView>
  );
}

export const EventPreviewMiniMap = ({ coverUrl, title, dateLabel, category, city, location }: Props) => {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={styles.cover} />
          ) : (
            <View style={[styles.cover, styles.coverPlaceholder]} />
          )}
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={styles.eventTitle} numberOfLines={1}>
              {title || 'Événement'}
            </Text>
            <Text style={styles.meta}>{dateLabel}</Text>
            <Text style={styles.meta}>{category || 'Catégorie'}</Text>
            <Text style={styles.meta}>{city || location?.addressLabel || 'Ville'}</Text>
          </View>
        </View>
        <View style={styles.mapBox}>
          <EventLocationPreviewMap location={location} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
    padding: spacing.md,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cover: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[200],
  },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTitle: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
  meta: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  mapBox: {
    height: 180,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.brand.surfaceMuted,
  },
  mapPlaceholder: {
    backgroundColor: colors.brand.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPlaceholderText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
});
