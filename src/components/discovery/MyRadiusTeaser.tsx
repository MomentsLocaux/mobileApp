import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MapPinned } from 'lucide-react-native';
import { Card } from '@/components/ui';
import { colors, spacing, typography } from '@/constants/theme';

type Props = {
  placesCount: number;
};

export function MyRadiusTeaser({ placesCount }: Props) {
  const hasPlaces = placesCount > 0;

  return (
    <Card padding="md" style={styles.card}>
      <View style={styles.header}>
        <MapPinned size={18} color={colors.brand.secondary} />
        <Text style={styles.title}>Mon territoire</Text>
      </View>
      {hasPlaces ? (
        <Text style={styles.body}>
          {placesCount} lieu{placesCount > 1 ? 'x' : ''} repéré{placesCount > 1 ? 's' : ''} dans votre territoire
          récent. Le détail complet arrive avec Moments Locaux+.
        </Text>
      ) : (
        <Text style={styles.body}>
          Votre territoire se construit au fil de vos découvertes. Activez la localisation plus tard pour
          enrichir cette vue.
        </Text>
      )}
      <Text style={styles.hint}>Aperçu gratuit · détails Premium à venir</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: colors.brand.text,
  },
  body: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    marginBottom: spacing.sm,
  },
  hint: {
    ...typography.caption,
    color: colors.brand.secondary,
  },
});
