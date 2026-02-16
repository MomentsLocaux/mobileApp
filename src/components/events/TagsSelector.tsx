import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';

const TAGS = [
  'Gratuit',
  'Enfants bienvenus',
  'Accessible PMR',
  'En extérieur',
  'Éphémère',
  'Nocturne',
  'Participatif',
];

type Props = {
  selected: string[];
  onChange: (tags: string[]) => void;
};

export const TagsSelector = ({ selected, onChange }: Props) => {
  const toggle = (tag: string) => {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag));
    } else if (selected.length < 5) {
      onChange([...selected, tag]);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tags rapides</Text>
      <View style={styles.row}>
        {TAGS.map((tag) => {
          const active = selected.includes(tag);
          return (
            <TouchableOpacity
              key={tag}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => toggle(tag)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{tag}</Text>
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
    color: colors.brand.text,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: colors.brand.surface,
  },
  chipActive: {
    borderColor: colors.brand.secondary,
    backgroundColor: 'rgba(43, 191, 227, 0.1)',
  },
  chipText: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.brand.secondary,
  },
});
