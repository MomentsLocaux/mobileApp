import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { PUSH_POLICY_OPTIONS, type PushPolicy } from '@/utils/push-personalization';
import { haptics } from '@/utils/haptics';

type Props = {
  policy: PushPolicy | null;
  onChangePolicy: (policy: PushPolicy) => void;
};

export function OnboardingPushPolicyStep({ policy, onChangePolicy }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title} accessibilityRole="header">
        Comment on te parle ?
      </Text>
      <Text style={styles.subtitle}>
        Le rayon, le rythme et les heures de silence restent ceux de l’étape précédente.
      </Text>

      <View accessibilityRole="radiogroup" style={styles.group}>
        {PUSH_POLICY_OPTIONS.map((option) => {
          const selected = policy === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => {
                haptics.selection();
                onChangePolicy(option.id);
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

      <Text style={styles.note}>Tu pourras changer ça dans Paramètres, Notifications.</Text>
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
