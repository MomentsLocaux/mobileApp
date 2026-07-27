import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Shuffle } from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';

/** Explique le switch Découvreur ↔ Créateur (B2C can_create). */
export function OnboardingModeHintStep() {
  return (
    <View style={styles.wrap}>
      <Shuffle size={28} color={colors.brand.secondary} strokeWidth={2.2} />
      <Text style={styles.title}>Deux modes, un seul compte</Text>
      <Text style={styles.body}>
        Tu restes toujours découvreur. Quand tu veux gérer tes publications, bascule en mode
        Créateur (couleurs dédiées). Habitué / Lumo, c’est pour sortir dans le quartier — pas un
        pack « organisateur ».
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, alignItems: 'flex-start' },
  title: { ...typography.h2, color: colors.brand.text },
  body: {
    ...typography.body,
    color: colors.brand.textSecondary,
    lineHeight: 22,
  },
});
