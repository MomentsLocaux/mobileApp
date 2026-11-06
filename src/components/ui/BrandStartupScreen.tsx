import React from 'react';
import { StyleSheet, Text, View, type ViewProps } from 'react-native';
import { AnimatedBrandMark } from './AnimatedBrandMark';
import { colors, spacing, typography } from '@/constants/theme';

type Props = { onLayout?: ViewProps['onLayout']; fontsReady?: boolean };

/** Shared presentation; the root applies its minimum once per cold start. */
export function BrandStartupScreen({ onLayout, fontsReady = true }: Props) {
  return (
    <View style={styles.screen} onLayout={onLayout}>
      <View accessible accessibilityRole="progressbar" accessibilityLabel="Chargement de Moments Locaux" style={styles.brand}>
        <AnimatedBrandMark size={96} variant="loading" />
        <Text style={[styles.name, fontsReady && styles.brandName]}>Moments Locaux</Text>
        <Text style={[styles.caption, fontsReady && styles.brandCaption]}>Chargement…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.brand.page, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  brand: { alignItems: 'center', gap: spacing.md },
  // Use the system font until useFonts has completed in the root layout.
  name: { color: colors.brand.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  brandName: { ...typography.h4 },
  caption: { color: colors.brand.textSecondary, fontSize: 14, textAlign: 'center' },
  brandCaption: { ...typography.bodySmall },
});
