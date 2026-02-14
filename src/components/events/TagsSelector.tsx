import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@/components/ui/v2';

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
              accessibilityRole="button"
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
    color: colors.textPrimary,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surfaceLevel1,
    justifyContent: 'center',
  },
  chipActive: {
    borderColor: 'transparent',
    backgroundColor: colors.primary,
  },
  chipText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.background,
  },
});
