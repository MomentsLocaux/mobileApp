import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import type { Demographics } from '@/services/demographics.service';

const GROUPS: {
  key: keyof Demographics;
  label: string;
  options: { value: string; label: string }[];
}[] = [
  {
    key: 'age_band',
    label: 'Tranche d’âge',
    options: [
      { value: '18-24', label: '18-24' },
      { value: '25-34', label: '25-34' },
      { value: '35-44', label: '35-44' },
      { value: '45-54', label: '45-54' },
      { value: '55-64', label: '55-64' },
      { value: '65-plus', label: '65 et plus' },
    ],
  },
  {
    key: 'household',
    label: 'Foyer',
    options: [
      { value: 'seul', label: 'Seul' },
      { value: 'couple', label: 'En couple' },
      { value: 'avec_enfants', label: 'Avec enfants' },
    ],
  },
  {
    key: 'life_situation',
    label: 'Situation',
    options: [
      { value: 'etudiant', label: 'Étudiant' },
      { value: 'actif', label: 'Actif' },
      { value: 'retraite', label: 'Retraité' },
    ],
  },
];

type Props = {
  value: Demographics;
  onChange: (next: Demographics) => void;
};

export function DemographicFields({ value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.note}>
        Facultatif. Ces réponses servent seulement à recevoir des messages qui te concernent. Tu peux tout passer.
      </Text>
      {GROUPS.map((group) => (
        <View key={group.key} style={styles.group}>
          <Text style={styles.label}>{group.label}</Text>
          <View style={styles.row}>
            {group.options.map((option) => {
              const active = value[group.key] === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => onChange({
                    ...value,
                    [group.key]: active ? null : option.value,
                  })}
                  style={[styles.chip, active && styles.chipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextOn]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  note: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  group: {
    gap: spacing.xs,
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.brand.text,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  chipOn: {
    backgroundColor: colors.brand.secondary,
    borderColor: colors.brand.secondary,
  },
  chipText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.brand.text,
  },
  chipTextOn: {
    color: colors.brand.primary,
    fontWeight: '700',
  },
});
