import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { BrandIcon } from '@/components/ui/BrandIcon';
import type { LocalPulse } from '@/utils/home-feed';

type Props = {
  pulse: LocalPulse;
  complete: boolean;
  onExplore: () => void;
};

export function LocalPulseCard({ pulse, complete, onExplore }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Explorer ${pulse.city}. ${complete ? pulse.detail : `Au moins ${pulse.detail}`}`}
      onPress={onExplore}
      style={styles.card}
    >
      <BrandIcon name="map" size={40} />
      <View style={styles.copy}>
        <Text style={styles.kicker}>ÇA BOUGE PRÈS DE CHEZ TOI</Text>
        <Text style={styles.title}>{pulse.city}</Text>
        <Text style={styles.detail}>{complete ? pulse.detail : `Au moins ${pulse.detail}`}</Text>
      </View>
      <BrandIcon name="navigation" size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.brand.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  kicker: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '700',
  },
  title: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
  detail: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },

});
