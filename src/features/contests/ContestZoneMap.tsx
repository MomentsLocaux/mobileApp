import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, Image, TouchableOpacity, Modal, Pressable } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import Constants from 'expo-constants';
import type { Feature, FeatureCollection, Polygon } from 'geojson';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import type { ContestEntry } from '@/features/contests';

Mapbox.setAccessToken(Constants.expoConfig?.extra?.mapboxToken || process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');

type Props = {
  entries: ContestEntry[];
  gridMeters?: number;
  onVotePress?: (entry: ContestEntry) => void;
  canVote?: boolean;
  myVoteEntryId?: string | null;
};

function buildZonePolygon(lat: number, lng: number, radiusMeters: number): Polygon {
  const points = 32;
  const latRad = (lat * Math.PI) / 180;
  const metersPerDegLat = 111320;
  const metersPerDegLng = Math.max(111320 * Math.cos(latRad), 1);
  const dLat = radiusMeters / metersPerDegLat;
  const dLng = radiusMeters / metersPerDegLng;
  const coordinates: [number, number][] = [];

  for (let i = 0; i <= points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    coordinates.push([lng + dLng * Math.cos(angle), lat + dLat * Math.sin(angle)]);
  }

  return { type: 'Polygon', coordinates: [coordinates] };
}

export function ContestZoneMap({
  entries,
  gridMeters = 500,
  onVotePress,
  canVote,
  myVoteEntryId,
}: Props) {
  const [selected, setSelected] = useState<ContestEntry | null>(null);
  const zoned = useMemo(
    () => entries.filter((entry) => entry.zone_lat != null && entry.zone_lng != null),
    [entries]
  );

  const radiusMeters = Math.max(50, (gridMeters || 500) / 2);

  const cameraCenter = useMemo(() => {
    if (zoned.length === 0) return [4.8357, 45.764] as [number, number];
    const lng =
      zoned.reduce((sum, entry) => sum + (entry.zone_lng as number), 0) / zoned.length;
    const lat =
      zoned.reduce((sum, entry) => sum + (entry.zone_lat as number), 0) / zoned.length;
    return [lng, lat] as [number, number];
  }, [zoned]);

  const shape = useMemo<FeatureCollection>(() => {
    const features: Feature[] = zoned.map((entry) => ({
      type: 'Feature',
      id: entry.id,
      geometry: buildZonePolygon(entry.zone_lat as number, entry.zone_lng as number, radiusMeters),
      properties: {
        id: entry.id,
        title: entry.title || 'Participation',
        votes: entry.votes_count || 0,
      },
    }));
    return { type: 'FeatureCollection', features };
  }, [zoned, radiusMeters]);

  if (zoned.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          Aucune participation géolocalisée pour le moment (zones uniquement).
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Mapbox.MapView style={styles.map} styleURL={Mapbox.StyleURL.Street} compassEnabled={false}>
        <Mapbox.Camera zoomLevel={12} centerCoordinate={cameraCenter} animationDuration={0} />
        <Mapbox.ShapeSource
          id="contest-zones"
          shape={shape}
          onPress={(event) => {
            const id = event.features?.[0]?.properties?.id;
            if (typeof id !== 'string') return;
            const entry = zoned.find((item) => item.id === id) || null;
            setSelected(entry);
          }}
        >
          <Mapbox.FillLayer
            id="contest-zones-fill"
            style={{
              fillColor: colors.brand.primary,
              fillOpacity: 0.22,
            }}
          />
          <Mapbox.LineLayer
            id="contest-zones-outline"
            style={{
              lineColor: colors.brand.primary,
              lineWidth: 2,
              lineOpacity: 0.8,
            }}
          />
        </Mapbox.ShapeSource>
      </Mapbox.MapView>

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelected(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {selected?.media_url ? (
              <Image source={{ uri: selected.media_url }} style={styles.preview} />
            ) : null}
            <Text style={styles.sheetTitle}>{selected?.title || 'Participation'}</Text>
            <Text style={styles.sheetMeta}>{selected?.votes_count || 0} votes · zone approximative</Text>
            {canVote && selected && onVotePress ? (
              <TouchableOpacity
                style={styles.voteBtn}
                onPress={() => {
                  onVotePress(selected);
                  setSelected(null);
                }}
              >
                <Text style={styles.voteText}>
                  {myVoteEntryId === selected.id ? 'Votre vote actuel' : 'Voter pour cette participation'}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => setSelected(null)}>
              <Text style={styles.closeText}>Fermer</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 320,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.neutral[800],
  },
  map: { flex: 1 },
  empty: {
    minHeight: 120,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[900],
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral[800],
  },
  emptyText: {
    ...typography.caption,
    color: colors.neutral[400],
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.neutral[950],
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: borderRadius.md,
  },
  sheetTitle: { ...typography.h3, color: colors.neutral[50] },
  sheetMeta: { ...typography.caption, color: colors.neutral[400] },
  voteBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.brand.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  voteText: { ...typography.bodyBold, color: colors.neutral[950] },
  closeText: {
    ...typography.caption,
    color: colors.neutral[400],
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
