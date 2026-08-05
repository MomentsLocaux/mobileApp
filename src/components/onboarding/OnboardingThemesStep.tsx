import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  CATEGORY_VISUAL_LABELS,
  CATEGORY_VISUAL_SLUGS,
  getCategoryLucideIcon,
  type CategoryVisualSlug,
} from '@/constants/category-visuals';
import { getCategoryColor, getCategoryTextColor } from '@/constants/categories';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { useTaxonomy } from '@/hooks/useTaxonomy';
import { useTaxonomyStore } from '@/store/taxonomyStore';

type Props = {
  selected: string[];
  onToggle: (slug: CategoryVisualSlug) => void;
  /** Override copy — discover vs create_themes. */
  title?: string;
  subtitle?: string;
};

/** PREF-P0-003 — cold-start theme declaration (skip = empty selection OK). */
export function OnboardingThemesStep({
  selected,
  onToggle,
  title = 'Qu’est-ce qui te tente ?',
  subtitle = 'Choisis quelques thèmes pour démarrer. Tu pourras les modifier dans Paramètres → Notifications. Tu peux aussi passer cette étape.',
}: Props) {
  useTaxonomy();
  const categoriesMap = useTaxonomyStore((state) => state.categoriesMap);
  const selectedSet = new Set(selected);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.chipRow}>
        {CATEGORY_VISUAL_SLUGS.map((slug) => {
          const active = selectedSet.has(slug);
          const category = categoriesMap[slug];
          const label = category?.label?.trim() || CATEGORY_VISUAL_LABELS[slug];
          const categoryColor = getCategoryColor(slug);
          const categoryTextColor = getCategoryTextColor(slug);
          const Icon = getCategoryLucideIcon(slug);

          return (
            <TouchableOpacity
              key={slug}
              onPress={() => onToggle(slug)}
              activeOpacity={0.75}
              style={[
                styles.chip,
                {
                  backgroundColor: `${categoryColor}18`,
                  borderColor: `${categoryColor}80`,
                },
                active && {
                  backgroundColor: categoryColor,
                  borderColor: categoryColor,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
            >
              <Icon size={16} color={active ? categoryTextColor : categoryColor} strokeWidth={2} />
              <Text
                style={[
                  styles.chipText,
                  { color: active ? categoryTextColor : categoryColor },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.brand.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.brand.textSecondary,
    lineHeight: 22,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    ...typography.caption,
    fontWeight: '600',
  },
});
