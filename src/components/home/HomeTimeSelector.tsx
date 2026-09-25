import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { HOME_TIME_SLOTS, type HomeTimeSlot } from '@/utils/home-feed';

type Props = {
  value: HomeTimeSlot;
  onChange: (slot: HomeTimeSlot) => void;
};

export function HomeTimeSelector({ value, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel="Période autour de toi"
    >
      {HOME_TIME_SLOTS.map((slot) => {
        const selected = slot.key === value;
        return (
          <Pressable
            key={slot.key}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            accessibilityLabel={slot.accessibilityLabel}
            onPress={() => {
              if (!selected) onChange(slot.key);
            }}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]} maxFontSizeMultiplier={1.3}>
              {slot.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  chipSelected: {
    backgroundColor: colors.brand.secondary,
    borderColor: colors.brand.ink,
    borderBottomWidth: 3,
  },
  label: {
    ...typography.label,
    color: colors.brand.text,
  },
  labelSelected: {
    color: colors.brand.onAccent,
    fontWeight: '700',
  },
});
