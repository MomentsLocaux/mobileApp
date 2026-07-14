import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Crown } from 'lucide-react-native';
import { colors } from '@/constants/theme';

type PremiumAvatarFrameProps = {
  isPremium: boolean;
  size: number;
  children: React.ReactNode;
  showBadge?: boolean;
};

export function PremiumAvatarFrame({
  isPremium,
  size,
  children,
  showBadge = true,
}: PremiumAvatarFrameProps) {
  const borderWidth = isPremium ? 3 : 2;
  const outerSize = size + borderWidth * 2 + 4;
  const badgeSize = Math.max(16, Math.round(size * 0.28));

  return (
    <View
      style={[
        styles.frame,
        {
          width: outerSize,
          height: outerSize,
          borderRadius: outerSize / 2,
          borderWidth,
          borderColor: isPremium ? colors.brand.premium : colors.brand.secondary,
          padding: 2,
        },
        isPremium && styles.premiumGlow,
      ]}
    >
      {children}
      {isPremium && showBadge ? (
        <View
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              bottom: -2,
              right: -2,
            },
          ]}
        >
          <Crown size={badgeSize * 0.55} color={colors.brand.primary} strokeWidth={2.5} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  premiumGlow: {
    shadowColor: colors.brand.premium,
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  badge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.premiumLight,
    borderWidth: 2,
    borderColor: colors.brand.primary,
  },
});
