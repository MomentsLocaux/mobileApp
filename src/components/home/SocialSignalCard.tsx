import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { BrandIcon } from '@/components/ui/BrandIcon';
import type { SocialSignal } from '@/utils/home-feed';

type Props = {
  signal: SocialSignal;
  onPress: () => void;
};

export function SocialSignalCard({ signal, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${signal.caption}, ${signal.title}`}
      onPress={onPress}
      style={styles.card}
    >
      <BrandIcon name="users" size={28} />
      <View style={styles.copy}>
        <Text style={styles.caption}>{signal.caption}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {signal.title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: colors.primary[200],
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  caption: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  title: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
});
