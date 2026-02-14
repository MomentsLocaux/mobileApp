import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Typography, colors, radius, spacing } from '@/components/ui/v2';

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
      onPress={onPress}
    >
      <View style={styles.headerRow}>
        <Typography variant="caption" color={colors.textSecondary} weight="700">
          {label}
        </Typography>
        {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
      </View>

      <Typography variant="sectionTitle" color={colors.textPrimary} weight="700" numberOfLines={1}>
        {value}
      </Typography>

      {helper ? (
        <Typography variant="caption" color={colors.textSecondary}>
          {helper}
        </Typography>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    minWidth: 188,
    minHeight: 132,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(43, 191, 227, 0.14)',
  },
});
