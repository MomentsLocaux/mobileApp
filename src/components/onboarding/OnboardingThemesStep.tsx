import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CATEGORY_VISUAL_SLUGS, type CategoryVisualSlug } from '@/constants/category-visuals';
import { THEME_CHIP_LABELS } from '@/services/preferences.service';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';

type Props = {
  selected: string[];
  onToggle: (slug: CategoryVisualSlug) => void;
};

/** PREF-P0-003 — cold-start theme declaration (skip = empty selection OK). */
export function OnboardingThemesStep({ selected, onToggle }: Props) {
  const selectedSet = new Set(selected);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Qu’est-ce qui te tente ?</Text>
      <Text style={styles.subtitle}>
        Choisis quelques thèmes pour démarrer. Tu pourras les modifier dans Paramètres →
        Notifications. Tu peux aussi passer cette étape.
      </Text>
      <View style={styles.chipRow}>
        {CATEGORY_VISUAL_SLUGS.map((slug) => {
          const active = selectedSet.has(slug);
          return (
            <TouchableOpacity
              key={slug}
              onPress={() => onToggle(slug)}
              activeOpacity={0.75}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {THEME_CHIP_LABELS[slug]}
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'transparent',
  },
  chipActive: {
    backgroundColor: colors.brand.secondary,
    borderColor: colors.brand.secondary,
  },
  chipText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.brand.primary,
  },
});
