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

/** Explains Mon territoire benefits — no free teaser counters as the sales hook. */
export function MyRadiusTeaser({ placesCount: _placesCount, isPremium = false, onUnlockPress }: Props) {
  const showUnlock = !isPremium && !!onUnlockPress;

  const content = (
    <>
      <View style={styles.header}>
        <MapPinned size={18} color={colors.brand.secondary} />
        <Text style={styles.title}>Carte de votre zone</Text>
      </View>
      <Text style={styles.body}>
        Voyez où vous sortez et découvrez de nouveaux coins proches. Avec Éclaireur, la carte détaillée
        et l’historique de votre zone deviennent disponibles.
      </Text>
      <Text style={styles.hint}>
        {isPremium
          ? 'Éclaireur actif — détail de zone inclus'
          : 'Inclus dans Éclaireur (avec tout Habitué)'}
      </Text>
      {showUnlock && (
        <View style={styles.ctaRow}>
          <Text style={styles.ctaText}>Découvrir Éclaireur</Text>
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
