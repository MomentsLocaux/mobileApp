import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapboxGL from '@rnmapbox/maps';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { MapboxService, type GeocodeResult } from '@/services/mapbox.service';
import { useCreateEventStore, type EventLocation } from '@/hooks/useCreateEventStore';
import { MapPin } from 'lucide-react-native';

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');

const FR_CENTER: [number, number] = [2.2137, 46.2276];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export const LocationPickerModal = ({ visible, onClose }: Props) => {
  const location = useCreateEventStore((s) => s.location);
  const setLocation = useCreateEventStore((s) => s.setLocation);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<GeocodeResult | null>(null);

  const center = useMemo<[number, number]>(() => {
    if (selected) return [selected.longitude, selected.latitude];
    if (location) return [location.longitude, location.latitude];
    return FR_CENTER;
  }, [selected, location]);

  useEffect(() => {
    let active = true;
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    MapboxService.search(query)
      .then((res) => {
        if (active) setResults(res);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [query]);

  const handleConfirm = () => {
    if (!selected) return;
    const loc: EventLocation = {
      latitude: selected.latitude,
      longitude: selected.longitude,
      addressLabel: selected.label,
      city: selected.city,
      postalCode: selected.postalCode,
      country: selected.country,
    };
    setLocation(loc);
    onClose();
  };

  const onDragEnd = async (coords: number[]) => {
    const [lon, lat] = coords;
    const rev = await MapboxService.reverse(lat, lon);
    if (rev) setSelected(rev);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Choisir un emplacement</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.link}>Fermer</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <MapPin size={18} color={colors.neutral[500]} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une adresse"
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
        </View>
        {loading && <ActivityIndicator style={{ marginVertical: spacing.sm }} />}
        <FlatList
          data={results}
          keyExtractor={(item) => `${item.latitude}-${item.longitude}-${item.label}`}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.resultRow} onPress={() => setSelected(item)}>
              <Text style={styles.resultText}>{item.label}</Text>
            </TouchableOpacity>
          )}
          style={{ maxHeight: 140 }}
        />

        <View style={styles.mapContainer}>
          <MapboxGL.MapView style={StyleSheet.absoluteFill} styleURL={MapboxGL.StyleURL.Street}>
            <MapboxGL.Camera centerCoordinate={center} zoomLevel={selected ? 13 : 5} />
            <MapboxGL.PointAnnotation
              id="selected-point"
              coordinate={selected ? [selected.longitude, selected.latitude] : center}
              draggable
              onDragEnd={(e) => onDragEnd(e.geometry.coordinates as number[])}
            />
          </MapboxGL.MapView>
        </View>

        <TouchableOpacity
          style={[styles.confirmBtn, !selected && styles.confirmDisabled]}
          onPress={handleConfirm}
          disabled={!selected}
        >
          <Text style={styles.confirmText}>Confirmer l'emplacement</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: '#fff',
    paddingTop: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h4,
    color: colors.neutral[900],
  },
  link: {
    ...typography.body,
    color: colors.primary[600],
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[50],
  },
  searchInput: {
    flex: 1,
  },
  resultRow: {
    paddingVertical: spacing.sm,
  },
  resultText: {
    ...typography.body,
    color: colors.neutral[800],
  },
  mapContainer: {
    marginTop: spacing.md,
    height: 260,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.neutral[100],
  },
  confirmBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    alignItems: 'center',
  },
  confirmDisabled: {
    backgroundColor: colors.neutral[300],
  },
  confirmText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
  },
});
