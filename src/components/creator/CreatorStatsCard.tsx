import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '@/components/ui';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';

interface CreatorStatsCardProps {
  label: string;
  value: string | number;
  helper?: string;
  icon?: React.ReactNode;
}

export function CreatorStatsCard({ label, value, helper, icon }: CreatorStatsCardProps) {
  return (
    <Card padding="md" style={styles.card} elevation="sm">
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
    backgroundColor: colors.neutral[0],
    minWidth: 150,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  label: {
    ...typography.bodySmall,
    color: colors.neutral[600],
    fontWeight: '600',
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[50],
  },
  value: {
    ...typography.h4,
    color: colors.neutral[900],
    fontWeight: '700',
  },
  helper: {
    ...typography.caption,
    color: colors.neutral[500],
    marginTop: spacing.xs,
  },
});
