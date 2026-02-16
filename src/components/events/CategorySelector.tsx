import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
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
  const [showSubcategories, setShowSubcategories] = useState(true);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Catégorie</Text>
      <View style={styles.grid}>
        {categories.map((cat) => {
          const active = selected === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.card, active && styles.cardActive]}
              onPress={() => onSelect(cat.id)}
              activeOpacity={0.85}
            >
              <Text style={[styles.cardText, active && styles.cardTextActive]}>{cat.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {selected && onSelectSubcategory && (
        <View style={{ gap: spacing.sm }} onLayout={onSubcategoryLayout}>
          <TouchableOpacity
            style={styles.collapseHeader}
            onPress={() => setShowSubcategories((prev) => !prev)}
            activeOpacity={0.85}
          >
            <Text style={styles.title}>Sous-catégorie</Text>
            <Text style={styles.collapseLabel}>{showSubcategories ? 'Masquer' : 'Afficher'}</Text>
          </TouchableOpacity>
          {showSubcategories && (
            <View style={styles.grid}>
              {subcategories.filter((s) => s.category_id === selected).length === 0 ? (
                <View style={[styles.card, styles.cardActive]}>
                  <Text style={[styles.cardText, styles.cardTextActive]}>Aucune sous-catégorie disponible</Text>
                </View>
              ) : (
                subcategories
                  .filter((s) => s.category_id === selected)
                  .map((sub) => {
                    const active = subcategory === sub.id;
                    return (
                      <TouchableOpacity
                        key={sub.id}
                        style={[styles.card, active && styles.cardActive]}
                        onPress={() => onSelectSubcategory(active ? undefined : sub.id)}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.cardText, active && styles.cardTextActive]}>{sub.label}</Text>
                      </TouchableOpacity>
                    );
                  })
              )}
              <TouchableOpacity
                style={[styles.card, !subcategory && styles.cardActive]}
                onPress={() => onSelectSubcategory(undefined)}
                activeOpacity={0.85}
              >
                <Text style={[styles.cardText, !subcategory && styles.cardTextActive]}>Autre / non précisé</Text>
              </TouchableOpacity>
            </View>
          )}
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  collapseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collapseLabel: {
    ...typography.bodySmall,
    color: colors.brand.secondary,
    fontWeight: '600',
  },
  card: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: colors.brand.surface,
    minWidth: '45%',
  },
  cardActive: {
    borderColor: colors.brand.secondary,
    backgroundColor: 'rgba(43, 191, 227, 0.1)',
  },
  cardText: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '600',
  },
  cardTextActive: {
    color: colors.brand.secondary,
  },
});
