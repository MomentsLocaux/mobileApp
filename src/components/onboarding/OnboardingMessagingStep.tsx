import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import type { ProfileMessagingVisibility } from '@/utils/messaging-access';
import { haptics } from '@/utils/haptics';

const OPTIONS: { value: ProfileMessagingVisibility; title: string; detail: string }[] = [
  {
    value: 'private',
    title: 'Privé',
    detail: 'On peut te trouver et te suivre. Seules les personnes que tu suis, et qui te suivent aussi, peuvent t’écrire.',
  },
  {
    value: 'public',
    title: 'Public',
    detail: 'On peut te trouver et te suivre. N’importe quel membre connecté peut t’écrire, même sans te suivre.',
  },
];

type Props = {
  visibility: ProfileMessagingVisibility;
  onChange: (visibility: ProfileMessagingVisibility) => void;
};

export function OnboardingMessagingStep({ visibility, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title} accessibilityRole="header">
        Qui peut t’écrire ?
      </Text>
      <Text style={styles.subtitle}>
        Ton profil reste dans Membres. Ce choix ne cache pas ton nom ni ta ville.
      </Text>

      <View accessibilityRole="radiogroup" style={styles.group}>
        {OPTIONS.map((option) => {
          const selected = visibility === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                haptics.selection();
                onChange(option.value);
              }}
              style={[styles.card, selected && styles.cardSelected]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${option.title}. ${option.detail}`}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{option.title}</Text>
                {selected ? <Check size={18} color={colors.brand.secondary} strokeWidth={2.6} /> : null}
              </View>
              <Text style={styles.cardDetail}>{option.detail}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.note}>
        Tu pourras changer ça dans Paramètres, Visibilité du profil.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  title: {
    ...typography.h2,
    letterSpacing: -0.6,
    color: colors.brand.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.brand.textSecondary,
    lineHeight: 22,
  },
  group: {
    gap: spacing.sm,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.brand.line,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.brand.surface,
  },
  cardSelected: {
    borderColor: colors.brand.secondary,
    backgroundColor: colors.brand.surfaceMuted,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.bodyBold,
    color: colors.brand.text,
    flex: 1,
  },
  cardDetail: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  note: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    lineHeight: 18,
  },
});
