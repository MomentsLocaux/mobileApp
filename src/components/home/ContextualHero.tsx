import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';
import type { HomeHeroContent } from '@/utils/home-feed';

type Props = {
  hero: HomeHeroContent;
};

export function ContextualHero({ hero }: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="header">
      <Text style={styles.kicker}>LES IDÉES DU JOUR</Text>
      <Text style={styles.title} maxFontSizeMultiplier={1.4}>
        {hero.title}
      </Text>
      {hero.subtitle ? (
        <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>
          {hero.subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  kicker: { ...typography.caption, letterSpacing: 1.5, color: colors.brand.textSecondary, fontWeight: '700' },
  title: {
    ...typography.h3,
    color: colors.brand.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.brand.textSecondary,
  },
});
