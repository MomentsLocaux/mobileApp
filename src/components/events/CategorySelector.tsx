import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { getCategoryLucideIcon } from '@/constants/category-visuals';
import { useTaxonomy } from '@/hooks/useTaxonomy';
import { useTaxonomyStore } from '@/store/taxonomyStore';

type Props = {
  selected?: string;
  onSelect: (value: string) => void;
  subcategory?: string;
  onSelectSubcategory?: (value: string | undefined) => void;
  onSubcategoryLayout?: (event: LayoutChangeEvent) => void;
};

export const CategorySelector = ({
  selected,
  onSelect,
  subcategory,
  onSelectSubcategory,
  onSubcategoryLayout,
}: Props) => {
  useTaxonomy();
  const categories = useTaxonomyStore((s) => s.categories);
  const subcategories = useTaxonomyStore((s) => s.subcategories);

  const selectedSubcategories = useMemo(
    () => subcategories.filter((s) => s.category_id === selected),
    [subcategories, selected],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Catégorie</Text>
      <View style={styles.list}>
        {categories.map((cat) => {
          const active = selected === cat.id;
          const Icon = getCategoryLucideIcon(cat.slug);
          const catColor = cat.color || colors.brand.secondary;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.card,
                { backgroundColor: `${catColor}20`, borderColor: `${catColor}66` },
                active && { backgroundColor: `${catColor}30`, borderColor: catColor },
              ]}
              onPress={() => onSelect(cat.id)}
              activeOpacity={0.85}
            >
              <View style={[styles.iconWrap, { backgroundColor: `${catColor}3A` }]}>
                <Icon size={18} color={catColor} />
              </View>
              <Text style={[styles.cardText, active && { color: catColor }]}>{cat.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selected && onSelectSubcategory && (
        <View style={styles.subSection} onLayout={onSubcategoryLayout}>
          <Text style={styles.title}>Sous-catégorie</Text>
          <View style={styles.list}>
            {selectedSubcategories.map((sub) => {
              const active = subcategory === sub.id;
              return (
                <TouchableOpacity
                  key={sub.id}
                  style={[styles.subCard, active && styles.subCardActive]}
                  onPress={() => onSelectSubcategory(active ? undefined : sub.id)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.subCardText, active && styles.subCardTextActive]}>{sub.label}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[styles.subCard, !subcategory && styles.subCardActive]}
              onPress={() => onSelectSubcategory(undefined)}
              activeOpacity={0.85}
            >
              <Text style={[styles.subCardText, !subcategory && styles.subCardTextActive]}>
                Autre / non précisé
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  title: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
  list: {
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '700',
    flex: 1,
  },
  subSection: {
    gap: spacing.sm,
  },
  subCard: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.brand.line,
  },
  subCardActive: {
    borderColor: colors.brand.secondary,
  },
  subCardText: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '700',
  },
  subCardTextActive: {
    color: colors.brand.secondary,
  },
});
