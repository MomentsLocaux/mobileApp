import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '@/components/ui';
import { borderRadius, colors, minimumTouchTarget, spacing, typography } from '@/constants/theme';

interface CreatorStatsCardProps {
  label: string;
  value: string | number;
  helper?: string;
  icon?: React.ReactNode;
  onPress?: () => void;
}

export function CreatorStatsCard({ label, value, helper, icon, onPress }: CreatorStatsCardProps) {
  return (
    <Card
      padding="md"
      style={styles.card}
      elevation="sm"
      onPress={onPress}
      accessible
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={`${label} ${value}`}
    >
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>
        {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
      </View>
      <Text style={styles.value}>{value}</Text>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.secondaryAccent[500],
    minWidth: 170,
    minHeight: minimumTouchTarget * 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  label: {
    ...typography.bodySmall,
    color: colors.textSecondary[500],
    fontWeight: '600',
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background[500],
  },
  value: {
    ...typography.h4,
    color: colors.textPrimary[500],
    fontWeight: '700',
  },
  helper: {
    ...typography.caption,
    color: colors.textSecondary[500],
    marginTop: spacing.xs,
  },
});
