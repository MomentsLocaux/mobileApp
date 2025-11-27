import React, { useMemo } from 'react';
import { View, TextInput, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useGeocoding } from '../hooks/useGeocoding';
import type { MapboxFeature } from '../types/mapbox';
import { colors, spacing, typography, borderRadius } from '../constants/theme';

interface AddressAutocompleteInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (item: MapboxFeature) => void;
  placeholder?: string;
}

export function AddressAutocompleteInput({
  value,
  onChangeText,
  onSelect,
  placeholder = 'Entrez une adresse',
}: AddressAutocompleteInputProps) {
  const [dropdownVisible, setDropdownVisible] = React.useState(false);
  const results = useGeocoding(value);

  const data = useMemo(() => results.slice(0, 5), [results]);

  return (
    <View style={styles.container}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        style={styles.input}
        placeholderTextColor={colors.neutral[400]}
        autoCorrect={false}
        autoCapitalize="none"
        onFocus={() => setDropdownVisible(true)}
      />

      {dropdownVisible && value.length >= 3 && data.length > 0 && (
        <View style={styles.list}>
          {data.map((item) => {
            const city =
              item.context?.find((c) => c.id.startsWith('place'))?.text ||
              item.context?.find((c) => c.id.startsWith('locality'))?.text ||
              '';
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.item}
                onPress={() => {
                  onSelect(item);
                  setDropdownVisible(false);
                }}
              >
                <Text style={styles.itemTitle}>{item.place_name}</Text>
                {city ? <Text style={styles.itemSubtitle}>{city}</Text> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.neutral[0],
    ...typography.body,
  },
  list: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[0],
    maxHeight: 240,
  },
  item: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  itemTitle: {
    ...typography.body,
    color: colors.neutral[900],
  },
  itemSubtitle: {
    ...typography.bodySmall,
    color: colors.neutral[500],
  },
});
