import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { MapboxService } from '@/services/mapbox.service';

export type RoadtripPlace = {
  label: string;
  latitude: number;
  longitude: number;
};

type Props = {
  label: string;
  value: RoadtripPlace | null;
  onChange: (place: RoadtripPlace | null) => void;
  presets: RoadtripPlace[];
  allowClear?: boolean;
  clearLabel?: string;
  placeholder?: string;
};

/**
 * City/place picker: quick presets + free Mapbox geocoding search.
 */
export function RoadtripPlaceField({
  label,
  value,
  onChange,
  presets,
  allowClear = false,
  clearLabel = 'Aucune',
  placeholder = 'Ville ou adresse…',
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RoadtripPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const id = ++requestId.current;
    setSearching(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const found = await MapboxService.search(trimmed, { types: 'place,locality' });
          if (id !== requestId.current) return;
          setResults(
            found.slice(0, 5).map((item) => ({
              label: item.city || item.label.split(',')[0] || item.label,
              latitude: item.latitude,
              longitude: item.longitude,
            })),
          );
        } catch {
          if (id === requestId.current) setResults([]);
        } finally {
          if (id === requestId.current) setSearching(false);
        }
      })();
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const select = (place: RoadtripPlace) => {
    onChange(place);
    setQuery('');
    setResults([]);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionLabel} accessibilityRole="header">
        {label}
      </Text>
      {value ? (
        <Text style={styles.selected} accessibilityLabel={`${label} sélectionné : ${value.label}`}>
          {value.label}
        </Text>
      ) : null}

      <View style={styles.chipRow}>
        {allowClear ? (
          <Chip
            label={clearLabel}
            active={!value}
            onPress={() => onChange(null)}
            accessibilityLabel={`${clearLabel} pour ${label}`}
          />
        ) : null}
        {presets.map((city) => (
          <Chip
            key={`${label}-${city.label}`}
            label={city.label}
            active={value?.label === city.label}
            onPress={() => select(city)}
            accessibilityLabel={`${label} : ${city.label}`}
          />
        ))}
      </View>

      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder={placeholder}
        placeholderTextColor={colors.neutral[400]}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={`Rechercher ${label}`}
      />
      {searching ? <ActivityIndicator style={styles.spinner} color={colors.brand.secondary} /> : null}
      {results.length > 0 ? (
        <View style={styles.results} accessibilityRole="list">
          {results.map((place) => (
            <Pressable
              key={`${place.label}-${place.latitude}`}
              style={styles.resultRow}
              onPress={() => select(place)}
              accessibilityRole="button"
              accessibilityLabel={`Choisir ${place.label}`}
            >
              <Text style={styles.resultText}>{place.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  sectionLabel: { ...typography.bodyBold, color: colors.neutral[700], marginTop: spacing.sm },
  selected: { ...typography.caption, color: colors.brand.secondary, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    backgroundColor: colors.neutral[0],
  },
  chipActive: {
    backgroundColor: colors.brand.page,
    borderColor: colors.brand.primary,
  },
  chipText: { ...typography.caption, color: colors.neutral[700] },
  chipTextActive: { color: colors.neutral[0], fontWeight: '700' },
  input: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.neutral[900],
    backgroundColor: colors.neutral[0],
  },
  spinner: { marginTop: spacing.xs },
  results: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  resultRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral[200],
  },
  resultText: { ...typography.body, color: colors.neutral[800] },
});
