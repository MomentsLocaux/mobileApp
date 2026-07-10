import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Lightbulb, X } from 'lucide-react-native';
import { Card } from '@/components/ui';
import { colors, spacing, typography } from '@/constants/theme';
import type { DiscoveryInsight } from '@/types/discovery.types';

type Props = {
  insights: DiscoveryInsight[];
  onDismiss: (insightId: string) => void;
  onBreakLoopPress?: () => void;
};

export function DiscoveryInsightsCard({ insights, onDismiss, onBreakLoopPress }: Props) {
  if (insights.length === 0) return null;

  const top = insights[0];

  return (
    <Card padding="md" style={styles.card}>
      <View style={styles.header}>
        <Lightbulb size={18} color={colors.brand.secondary} />
        <Text style={styles.title}>Insight</Text>
        <TouchableOpacity onPress={() => onDismiss(top.id)} hitSlop={8}>
          <X size={16} color={colors.brand.textSecondary} />
        </TouchableOpacity>
      </View>
      <Text style={styles.insightTitle}>{top.title}</Text>
      <Text style={styles.body}>{top.body}</Text>
      {(top.type === 'repetitive_weekends' || top.type === 'no_new_place_recently') && onBreakLoopPress && (
        <TouchableOpacity onPress={onBreakLoopPress} style={styles.cta}>
          <Text style={styles.ctaText}>Voir Break the Loop</Text>
        </TouchableOpacity>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.caption,
    color: colors.brand.secondary,
    fontWeight: '600',
    flex: 1,
    textTransform: 'uppercase',
  },
  insightTitle: {
    ...typography.h3,
    color: colors.brand.text,
    marginBottom: spacing.xs,
  },
  body: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  cta: {
    marginTop: spacing.sm,
  },
  ctaText: {
    ...typography.bodySmall,
    color: colors.brand.secondary,
    fontWeight: '600',
  },
});
