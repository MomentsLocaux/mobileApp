import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import { Typography } from '../atoms/Typography';
import { ScaleOnPress } from '../animations/ScaleOnPress';

type DrawerItemProps = {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  highlight?: boolean;
  badgeCount?: number;
};

export function DrawerItem({ icon: IconCmp, label, onPress, highlight, badgeCount }: DrawerItemProps) {
  const showBadge = typeof badgeCount === 'number' && badgeCount > 0;

  return (
    <ScaleOnPress
      accessibilityRole="button"
      onPress={onPress}
      containerStyle={[styles.row, highlight && styles.rowHighlight]}
      scaleTo={0.985}
    >
      <IconCmp size={20} color={highlight ? colors.primary : colors.textSecondary} />

      <View style={styles.labelWrap}>
        <Typography
          variant="body"
          color={highlight ? colors.primary : colors.textPrimary}
          weight={highlight ? '700' : '600'}
        >
          {label}
        </Typography>
      </View>

      {showBadge ? (
        <View style={styles.badge}>
          <Typography variant="caption" color={colors.background} weight="700">
            {badgeCount! > 99 ? '99+' : badgeCount}
          </Typography>
        </View>
      ) : null}
    </ScaleOnPress>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    borderRadius: radius.element,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surfaceLevel1,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowHighlight: {
    borderColor: 'rgba(43, 191, 227, 0.5)',
    backgroundColor: 'rgba(43, 191, 227, 0.12)',
  },
  labelWrap: {
    flex: 1,
  },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
});
