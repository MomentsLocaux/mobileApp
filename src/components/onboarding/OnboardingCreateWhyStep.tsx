import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { HandHeart, Package, Repeat } from 'lucide-react-native';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { haptics } from '@/utils/haptics';

export type CreateIntent = 'talent' | 'micro_vente' | 'regulier';

const OPTIONS: {
  value: CreateIntent;
  label: string;
  description: string;
  Icon: typeof HandHeart;
}[] = [
  {
    value: 'talent',
    label: 'Partager mon talent',
    description: 'Atelier, concert, démo… sans en tirer de bénéfice plateforme.',
    Icon: HandHeart,
  },
  {
    value: 'micro_vente',
    label: 'Micro-vente / fait maison',
    description: 'Deux-trois produits, pop-up, marché — hors marketplace in-app.',
    Icon: Package,
  },
  {
    value: 'regulier',
    label: 'Activité régulière',
    description: 'Cours, dates récurrentes, public fidèle — toujours en Particulier.',
    Icon: Repeat,
  },
];

type Props = {
  value: CreateIntent | null;
  onChange: (value: CreateIntent) => void;
};

/** B2C create_why — pas un SKU Pro (ADR 004 amendé). */
export function OnboardingCreateWhyStep({ value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Tu crées pour quoi ?</Text>
      <Text style={styles.subtitle}>
        Pas besoin d’être « Pro » : publier reste gratuit. Habitué, c’est si tu sors aussi dans le
        quartier.
      </Text>
      <View style={styles.list}>
        {OPTIONS.map((opt) => {
          const active = value === opt.value;
          const Icon = opt.Icon;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.card, active && styles.cardActive]}
              onPress={() => {
                haptics.selection();
                onChange(opt.value);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Icon
                size={20}
                color={active ? colors.brand.primary : colors.brand.textSecondary}
                strokeWidth={2.2}
              />
              <View style={styles.copy}>
                <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
                <Text style={styles.hint}>{opt.description}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  title: { ...typography.h2, color: colors.brand.text },
  subtitle: {
    ...typography.body,
    color: colors.brand.textSecondary,
    lineHeight: 22,
  },
  list: { gap: spacing.sm },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  cardActive: {
    borderColor: colors.brand.secondary,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  copy: { flex: 1, gap: 4 },
  label: { ...typography.body, color: colors.brand.text, fontWeight: '600' },
  labelActive: { color: colors.brand.primary },
  hint: { ...typography.caption, color: colors.brand.textSecondary, lineHeight: 18 },
});
