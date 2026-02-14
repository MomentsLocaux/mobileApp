import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { ScaleOnPress } from '../animations/ScaleOnPress';
import { Typography } from '../atoms/Typography';

type SocialButtonProps = {
  provider: 'Google' | 'iOS';
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function SocialButton({ provider, onPress, style }: SocialButtonProps) {
  const iconLabel = provider === 'Google' ? 'G' : '';

  return (
    <ScaleOnPress
      accessibilityRole="button"
      accessibilityLabel={`Continuer avec ${provider}`}
      accessibilityHint={`Active la connexion ${provider}`}
      onPress={onPress}
      containerStyle={[styles.base, style]}
    >
      <View style={styles.iconWrap}>
        <Typography variant="caption" color={colors.textPrimary} weight="700">
          {iconLabel}
        </Typography>
      </View>
      <Typography variant="body" color={colors.textPrimary} weight="600">
        Continuer avec {provider}
      </Typography>
    </ScaleOnPress>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceLevel1,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
