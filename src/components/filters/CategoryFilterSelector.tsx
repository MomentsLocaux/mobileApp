import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getCategoryColor, getCategoryTextColor } from '@/constants/categories';
import { getCategoryLucideIcon } from '@/constants/category-visuals';
import { colors, typography } from '@/constants/theme';

type Props = {
  categories: { id: string; slug: string; label: string }[];
  values: string[];
  onChange: (values: string[]) => void;
  testID?: string;
};

/** One category presentation for search and map refinement. */
export function CategoryFilterSelector({ categories, values, onChange, testID }: Props) {
  const allSelected = categories.length > 0 && categories.every(cat => values.includes(cat.id));
  if (!categories.length) return null;
  return <View style={styles.section} testID={testID}>
    <View style={styles.header}>
      <Text style={styles.title}>Catégories</Text>
      <TouchableOpacity accessibilityRole="button" style={styles.all} onPress={() => onChange(allSelected ? [] : categories.map(cat => cat.id))}>
        <Text style={styles.allText}>{allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}</Text>
      </TouchableOpacity>
    </View>
    <View style={styles.chips}>
      {categories.map(cat => {
        const active = values.includes(cat.id);
        const accent = getCategoryColor(cat.id);
        const ink = active ? getCategoryTextColor(cat.id) : colors.brand.text;
        const Icon = getCategoryLucideIcon(cat.slug);
        return <TouchableOpacity key={cat.id} testID={testID ? `${testID}-${cat.id}` : undefined}
          accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={cat.label}
          onPress={() => onChange(active ? values.filter(id => id !== cat.id) : [...values, cat.id])}
          style={[styles.chip, { backgroundColor: active ? accent : `${accent}18`, borderColor: active ? accent : `${accent}55` }]}>
          <Icon size={22} color={active ? ink : accent} />
          <Text style={[styles.label, { color: ink }]}>{cat.label}</Text>
        </TouchableOpacity>;
      })}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 12 },
  title: { ...typography.body, fontWeight: '700', color: colors.brand.text },
  all: { minHeight: 44, justifyContent: 'center' },
  allText: { ...typography.bodySmall, color: colors.brand.text, textDecorationLine: 'underline' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, maxWidth: '100%', paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderRadius: 16 },
  label: { ...typography.bodySmall, fontWeight: '600', flexShrink: 1 },
});
