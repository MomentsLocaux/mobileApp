import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Check } from 'lucide-react-native';
import {
  CATEGORY_VISUAL_LABELS,
  CATEGORY_VISUAL_SLUGS,
  getCategoryLucideIcon,
  type CategoryVisualSlug,
} from '@/constants/category-visuals';
import { getCategoryHint } from '@/constants/category-hints';
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
      <View style={styles.categoryList}>
        {CATEGORY_VISUAL_SLUGS.map((slug) => {
          const active = selectedSet.has(slug);
          const category = categoriesMap[slug];
          const label = category?.label?.trim() || CATEGORY_VISUAL_LABELS[slug];
          const hint = getCategoryHint(slug);
          const categoryColor = getCategoryColor(slug);
          const categoryTextColor = getCategoryTextColor(slug);
          const Icon = getCategoryLucideIcon(slug);

          return (
            <TouchableOpacity
              key={slug}
              onPress={() => onToggle(slug)}
              activeOpacity={0.75}
              style={[
                styles.categoryCard,
                active && {
                  backgroundColor: `${categoryColor}26`,
                  borderColor: categoryColor,
                },
              ]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`Catégorie ${label}. ${hint}`}
            >
              <View
                style={[
                  styles.categoryIcon,
                  {
                    backgroundColor: `${categoryColor}22`,
                    borderColor: `${categoryColor}66`,
                  },
                ]}
              >
                <Icon size={21} color={categoryColor} strokeWidth={2} />
              </View>
              <View style={styles.categoryCopy}>
                <Text style={[styles.categoryLabel, active && { color: categoryColor }]}>
                  {label}
                </Text>
                <Text style={styles.categoryHint}>{hint}</Text>
              </View>
              <View
                style={[
                  styles.categoryCheck,
                  { borderColor: active ? categoryColor : `${categoryColor}80` },
                  active && { backgroundColor: categoryColor },
                ]}
              >
                {active ? (
                  <Check size={15} color={categoryTextColor} strokeWidth={3} />
                ) : null}
              </View>
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
  categoryList: {
    gap: spacing.sm,
  },
  categoryCard: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: colors.brand.surface,
  },
  categoryIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  categoryCopy: {
    flex: 1,
  },
  categoryLabel: {
    ...typography.h6,
    color: colors.brand.text,
  },
  categoryHint: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    marginTop: 3,
    lineHeight: 18,
  },
  categoryCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
});
