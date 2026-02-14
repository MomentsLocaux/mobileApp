import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, spacing } from '../theme';
import { Typography } from '../atoms/Typography';

type DividerProps = {
  label?: string;
  style?: StyleProp<ViewStyle>;
};

export function Divider({ label, style }: DividerProps) {
  if (!label) {
    return <View style={[styles.line, style]} />;
  }

  return (
    <View style={[styles.labeledWrap, style]}>
      <View style={styles.line} />
      <Typography variant="caption" color={colors.textSecondary} weight="700" style={styles.label}>
        {label}
      </Typography>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    height: 1,
    backgroundColor: colors.divider,
    flex: 1,
  },
  labeledWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    letterSpacing: 0.3,
  },
});
