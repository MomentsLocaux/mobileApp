import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';

const CATEGORIES = [
  { value: 'musique', label: 'Musique / Spectacle' },
  { value: 'art', label: 'Art / Expo' },
  { value: 'marche', label: 'Marché / Artisanat' },
  { value: 'deco', label: 'Décoration / Installation' },
  { value: 'rencontre', label: 'Rencontre / Animation' },
  { value: 'enfants', label: 'Enfants' },
  { value: 'food', label: 'Food / Dégustation' },
];

type Props = {
  selected?: string;
  onSelect: (value: string) => void;
};

export const CategorySelector = ({ selected, onSelect }: Props) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Catégorie</Text>
      <View style={styles.grid}>
        {CATEGORIES.map((cat) => {
          const active = selected === cat.value;
          return (
            <TouchableOpacity
              key={cat.value}
              style={[styles.card, active && styles.cardActive]}
              onPress={() => onSelect(cat.value)}
              activeOpacity={0.85}
            >
              <Text style={[styles.cardText, active && styles.cardTextActive]}>{cat.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  title: {
    ...typography.body,
    color: colors.neutral[900],
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  card: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
    minWidth: '45%',
  },
  cardActive: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  cardText: {
    ...typography.body,
    color: colors.neutral[800],
    fontWeight: '600',
  },
  cardTextActive: {
    color: colors.primary[700],
  },
});
