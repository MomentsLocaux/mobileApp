import React from 'react';
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

export const EventPreviewMiniMap = ({ coverUrl, title, dateLabel, category, city, location }: Props) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Aperçu</Text>
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
            <Text style={styles.meta}>{city || 'Ville'}</Text>
          </View>
        </View>
        <View style={styles.mapBox}>
          {location ? (
            <MapboxGL.MapView
              style={StyleSheet.absoluteFill}
              styleURL={MapboxGL.StyleURL.Street}
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
            >
              <MapboxGL.Camera
                zoomLevel={13}
                centerCoordinate={[location.longitude, location.latitude]}
              />
              <MapboxGL.PointAnnotation
                id="preview"
                coordinate={[location.longitude, location.latitude]}
              />
            </MapboxGL.MapView>
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.mapPlaceholder]} />
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  title: {
    ...typography.body,
    color: colors.neutral[900],
    fontWeight: '700',
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
    color: colors.neutral[900],
    fontWeight: '700',
  },
  meta: {
    ...typography.caption,
    color: colors.neutral[600],
  },
  mapBox: {
    height: 160,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.neutral[100],
  },
  mapPlaceholder: {
    backgroundColor: colors.neutral[100],
  },
});
