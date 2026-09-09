import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { LocateFixed, MapPin, SearchX, X } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography, minimumTouchTarget } from '@/constants/theme';
import { MapboxService, type GeocodeResult } from '@/services/mapbox.service';
import { useCreateEventStore, type EventLocation } from '@/hooks/useCreateEventStore';
import { useTaxonomyStore } from '@/store/taxonomyStore';
import { Button } from '@/components/ui';
import { haptics } from '@/utils/haptics';

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');

const FR_CENTER: [number, number] = [2.2137, 46.2276];
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_CHARS = 2;

type Props = {
  visible: boolean;
  onClose: () => void;
  location?: EventLocation | null;
  categoryId?: string | null;
  onConfirmLocation?: (location: EventLocation) => void;
  /**
   * Render as a full-screen overlay instead of a second RN Modal.
   * Required when the picker is opened from another Modal (iOS ignores stacked sibling Modals).
   */
  embedded?: boolean;
};

export const LocationPickerModal = ({
  visible,
  onClose,
  location: locationOverride,
  embedded = false,
  categoryId: categoryIdOverride,
  onConfirmLocation,
}: Props) => {
  const storeLocation = useCreateEventStore((s) => s.location);
  const storeCategoryId = useCreateEventStore((s) => s.category);
  const setLocation = useCreateEventStore((s) => s.setLocation);
  const location = locationOverride !== undefined ? locationOverride || undefined : storeLocation;
  const categoryId = categoryIdOverride !== undefined ? categoryIdOverride || undefined : storeCategoryId;
  const category = useTaxonomyStore((s) => s.categoriesMap[categoryId || '']);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<GeocodeResult | null>(null);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  const cameraRef = useRef<MapboxGL.Camera>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0);
  const markerColor = category?.color || colors.brand.secondary;

  useEffect(() => {
    if (!visible) return;
    if (location) {
      const existing: GeocodeResult = {
        latitude: location.latitude,
        longitude: location.longitude,
        label: location.addressLabel,
        city: location.city,
        region: '',
        postalCode: location.postalCode,
        country: location.country,
      };
      setSelected(existing);
      setQuery(location.addressLabel || '');
      setResults([]);
    } else {
      setSelected(null);
      setQuery('');
      setResults([]);
    }
  }, [visible, location]);

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  const center = useMemo<[number, number]>(() => {
    if (selected) return [selected.longitude, selected.latitude];
    if (location) return [location.longitude, location.latitude];
    return FR_CENTER;
  }, [selected, location]);

  const showNoResults =
    !loading &&
    !selected &&
    query.trim().length >= SEARCH_MIN_CHARS &&
    results.length === 0;

  const handleSearchChange = useCallback((value: string) => {
    setQuery(value);
    setSelected(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (value.trim().length < SEARCH_MIN_CHARS) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    searchTimer.current = setTimeout(async () => {
      const seq = ++searchSeq.current;
      try {
        // Full address geocoding for event creation (street + place + locality).
        const res = await MapboxService.search(value, {
          types: 'poi,address,place,locality',
        });
        if (seq !== searchSeq.current) return;
        setResults(res);
      } catch {
        if (seq === searchSeq.current) setResults([]);
      } finally {
        if (seq === searchSeq.current) setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const handleSelectResult = useCallback((item: GeocodeResult) => {
    haptics.selection();
    Keyboard.dismiss();
    setSelected(item);
    setQuery(item.label);
    setResults([]);
  }, []);

  const handleConfirm = () => {
    if (!selected) return;
    haptics.light();
    const loc: EventLocation = {
      latitude: selected.latitude,
      longitude: selected.longitude,
      addressLabel: selected.label,
      city: selected.city,
      postalCode: selected.postalCode,
      country: selected.country,
    };
    if (onConfirmLocation) onConfirmLocation(loc);
    else setLocation(loc);
    onClose();
  };

  const applyCoordinates = useCallback(
    async (
      coords: number[],
      options?: { keepExactCoords?: boolean; fallbackLabel?: string },
    ) => {
      const [lon, lat] = coords;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      setReverseLoading(true);
      try {
        const rev = await MapboxService.reverse(lat, lon);
        const next: GeocodeResult | null = rev
          ? options?.keepExactCoords
            ? { ...rev, latitude: lat, longitude: lon }
            : rev
          : options?.fallbackLabel
            ? {
                latitude: lat,
                longitude: lon,
                label: options.fallbackLabel,
                city: '',
                region: '',
                postalCode: '',
                country: 'FR',
              }
            : null;
        if (!next) return;
        haptics.selection();
        setSelected(next);
        setQuery(next.label);
        setResults([]);
      } finally {
        setReverseLoading(false);
      }
    },
    [],
  );

  const handleLocateMe = useCallback(async () => {
    if (locating) return;
    Keyboard.dismiss();
    setLocating(true);
    try {
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        ({ status } = await Location.requestForegroundPermissionsAsync());
      }
      if (status !== 'granted') {
        Alert.alert(
          'Position',
          'Autorisez la localisation pour centrer la carte sur vous et remplir l’adresse.',
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
      await applyCoordinates(coords, {
        keepExactCoords: true,
        fallbackLabel: 'Ma position actuelle',
      });
      cameraRef.current?.setCamera({
        centerCoordinate: coords,
        zoomLevel: 15,
        animationDuration: 650,
      });
    } catch {
      Alert.alert('Position', 'Impossible de récupérer votre position actuelle.');
    } finally {
      setLocating(false);
    }
  }, [applyCoordinates, locating]);

  const content = (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Choisir un emplacement</Text>
          <Text style={styles.helper}>
            Recherchez une adresse, utilisez Localiser, ou posez le pin sur la carte.
          </Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
          hitSlop={8}
        >
          <X size={20} color={colors.brand.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Adresse ou lieu</Text>
          <View style={styles.searchField}>
            <MapPin size={18} color={colors.brand.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Ex. 10 rue de Rivoli, Paris"
              placeholderTextColor={colors.brand.textSecondary}
              value={query}
              onChangeText={handleSearchChange}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              accessibilityLabel="Rechercher une adresse"
            />
          </View>
          <Button
            title="Localiser"
            variant="outline"
            size="sm"
            onPress={() => void handleLocateMe()}
            loading={locating}
            disabled={locating || reverseLoading}
            accessibilityLabel="Localiser et centrer sur ma position"
            accessibilityHint="Utilise votre GPS pour remplir l’adresse et centrer la carte"
          />
        </View>

        {loading && !selected ? (
          <View style={styles.searchStatus}>
            <ActivityIndicator size="small" color={colors.brand.secondary} />
            <Text style={styles.meta}>Recherche en cours…</Text>
          </View>
        ) : null}

        {results.length > 0 ? (
          <View style={styles.resultsContainer}>
            {results.map((item) => (
              <TouchableOpacity
                key={`${item.latitude}-${item.longitude}-${item.label}`}
                style={styles.resultRow}
                onPress={() => handleSelectResult(item)}
                accessibilityRole="button"
                accessibilityLabel={`Choisir ${item.label}`}
              >
                <MapPin size={16} color={colors.brand.secondary} />
                <Text style={styles.resultText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {showNoResults ? (
          <View style={styles.searchStatus}>
            <SearchX size={16} color={colors.brand.textSecondary} />
            <Text style={styles.meta}>Aucun lieu trouvé, essayez une autre orthographe.</Text>
          </View>
        ) : null}

        {selected ? (
          <View style={styles.selection}>
            <MapPin size={16} color={colors.brand.secondary} />
            <View style={styles.selectionCopy}>
              <Text style={styles.meta}>Lieu sélectionné</Text>
              <Text style={styles.info}>{selected.label}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.mapContainer}>
          <MapboxGL.MapView
            style={StyleSheet.absoluteFill}
            styleURL={MapboxGL.StyleURL.Dark}
            onPress={(e) => {
              if (locating) return;
              const coords = (e?.geometry as { coordinates?: number[] } | undefined)?.coordinates;
              if (coords) void applyCoordinates(coords);
            }}
          >
            <MapboxGL.Camera
              ref={cameraRef}
              centerCoordinate={center}
              zoomLevel={selected ? 14 : 5}
              animationMode="flyTo"
            />
            <MapboxGL.PointAnnotation
              id="selected-point"
              coordinate={selected ? [selected.longitude, selected.latitude] : center}
              draggable={!!selected}
              onDragEnd={(e) => void applyCoordinates(e.geometry.coordinates as number[])}
            >
              <View style={[styles.markerDot, { backgroundColor: markerColor }]} />
            </MapboxGL.PointAnnotation>
          </MapboxGL.MapView>
          {reverseLoading || locating ? (
            <View style={styles.mapOverlay} pointerEvents="none">
              <ActivityIndicator color={colors.brand.secondary} />
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.locateMapBtn}
            onPress={() => void handleLocateMe()}
            disabled={locating || reverseLoading}
            accessibilityRole="button"
            accessibilityLabel="Centrer sur ma position"
            accessibilityState={{ disabled: locating || reverseLoading }}
            hitSlop={8}
          >
            {locating ? (
              <ActivityIndicator size="small" color={colors.brand.secondary} />
            ) : (
              <LocateFixed size={18} color={colors.brand.secondary} />
            )}
          </TouchableOpacity>
        </View>
        {selected ? (
          <Text style={styles.mapHint}>Touchez la carte ou déplacez le pin pour affiner l’adresse exacte.</Text>
        ) : (
          <Text style={styles.mapHint}>Touchez la carte ou choisissez un résultat de recherche.</Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Confirmer l'emplacement"
          onPress={handleConfirm}
          disabled={!selected || reverseLoading || locating}
          size="sm"
          style={styles.confirmBtn}
          accessibilityLabel="Confirmer l'emplacement"
        />
      </View>
    </SafeAreaView>
  );

  if (embedded) {
    if (!visible) return null;
    return <View style={styles.embeddedRoot}>{content}</View>;
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {content}
    </Modal>
  );
};

const styles = StyleSheet.create({
  embeddedRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    elevation: 40,
    backgroundColor: colors.brand.page,
  },
  container: {
    flex: 1,
    backgroundColor: colors.brand.page,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...typography.h4,
    color: colors.brand.text,
  },
  helper: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    lineHeight: 20,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  label: {
    ...typography.label,
    color: colors.brand.text,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 52,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.brand.text,
    paddingVertical: spacing.sm,
  },
  searchStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  meta: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    flex: 1,
  },
  info: {
    ...typography.body,
    color: colors.brand.text,
  },
  resultsContainer: {
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  resultText: {
    ...typography.bodySmall,
    color: colors.brand.text,
    flex: 1,
  },
  selection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(124, 181, 24,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(124, 181, 24,0.3)',
  },
  selectionCopy: {
    flex: 1,
    gap: 2,
  },
  mapContainer: {
    height: 240,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,25,0.35)',
  },
  locateMapBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 2,
    elevation: 3,
    width: minimumTouchTarget,
    height: minimumTouchTarget,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.12)',
  },
  mapHint: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: -spacing.xs,
  },
  markerDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    borderColor: 'rgba(15,23,25,0.9)',
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  confirmBtn: {
    width: '100%',
    minHeight: 48,
    maxHeight: 48,
  },
});
