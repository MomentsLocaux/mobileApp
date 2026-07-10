import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRight, MapPinned } from 'lucide-react-native';
import { Card } from '@/components/ui';
import { colors, spacing, typography } from '@/constants/theme';

type Props = {
  placesCount: number;
  isPremium?: boolean;
  onUnlockPress?: () => void;
};

export function MyRadiusTeaser({ placesCount, isPremium = false, onUnlockPress }: Props) {
  const hasPlaces = placesCount > 0;
  const showUnlock = !isPremium && !!onUnlockPress;

  const content = (
  <>
      <View style={styles.header}>
        <MapPinned size={18} color={colors.brand.secondary} />
        <Text style={styles.title}>Mon territoire</Text>
      </View>
      {hasPlaces ? (
        <Text style={styles.body}>
          {placesCount} lieu{placesCount > 1 ? 'x' : ''} repéré{placesCount > 1 ? 's' : ''} dans votre territoire
          récent.
          {isPremium
            ? ' Le détail complet arrive dans une prochaine mise à jour.'
            : ' Le détail complet est réservé à Moments Locaux+.'}
        </Text>
      ) : (
        <Text style={styles.body}>
          Votre territoire se construit au fil de vos découvertes. Activez la localisation passive pour
          enrichir cette vue.
        </Text>
      )}
      <Text style={styles.hint}>
        {isPremium ? 'Moments Locaux+ actif' : 'Aperçu gratuit · débloquez le détail avec Premium'}
      </Text>
      {showUnlock && (
        <View style={styles.ctaRow}>
          <Text style={styles.ctaText}>Découvrir Moments Locaux+</Text>
          <ChevronRight size={16} color={colors.brand.secondary} />
        </View>
      )}
    </>
  );

  if (showUnlock) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onUnlockPress}>
        <Card padding="md" style={styles.card}>
          {content}
        </Card>
      </TouchableOpacity>
    );
  }

  return (
    <Card padding="md" style={styles.card}>
      {content}
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
  ctaRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ctaText: {
    ...typography.bodySmall,
    color: colors.brand.secondary,
    fontWeight: '600',
  },
});
