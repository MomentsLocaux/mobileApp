import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LUMIA_AVATAR_LOCAL, LUMIA_NAME } from '@/constants/lumia';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';

type Props = {
  onPress: () => void;
};

export function HomeLumiaProposals({ onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${LUMIA_NAME} te propose des idées à explorer`}
      onPress={onPress}
      style={styles.card}
    >
      <Image source={LUMIA_AVATAR_LOCAL} style={styles.avatar} accessibilityIgnoresInvertColors />
      <View style={styles.copy}>
        <Text style={styles.kicker}>{LUMIA_NAME.toUpperCase()}</Text>
        <Text style={styles.title}>Je te glisse des idées à explorer</Text>
        <Text style={styles.detail}>Swipe, garde, ou passe — à ton rythme.</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.brand.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  kicker: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '700',
    letterSpacing: 1.1,
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
