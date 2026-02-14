import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import { Typography } from '../atoms/Typography';

type TopBarProps = {
  title: string;
  onBack?: () => void;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function TopBar({ title, onBack, leftSlot, rightSlot, style }: TopBarProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.side}>
        {leftSlot ? (
          leftSlot
        ) : onBack ? (
          <Pressable
            accessibilityRole="button"
            style={styles.backButton}
            onPress={onBack}
          >
            <ChevronLeft size={20} color={colors.textPrimary} />
          </Pressable>
        ) : (
          <View style={styles.spacer} />
        )}
      </View>

      <Typography variant="subsection" color={colors.textPrimary} weight="700" style={styles.title}>
        {title}
      </Typography>

      <View style={[styles.side, styles.right]}>{rightSlot ?? <View style={styles.spacer} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  side: {
    width: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  right: {
    alignItems: 'flex-end',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLevel1,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
  spacer: {
    width: 44,
    height: 44,
  },
});
