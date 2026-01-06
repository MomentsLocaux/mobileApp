import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SlidersHorizontal } from 'lucide-react-native';
import type { SortOption } from '@/types/filters';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';

const LABELS: Record<SortOption, string> = {
  triage: 'Pertinence',
  date: 'Date',
  distance: 'Distance',
  popularity: 'Popularité',
};

interface Props {
  value: SortOption;
  onChange: (value: SortOption) => void;
  hasLocation: boolean;
  showLabel?: boolean;
}

export const TriageControl: React.FC<Props> = ({ value, onChange, hasLocation, showLabel = true }) => {
  const [open, setOpen] = useState(false);
  const options = useMemo<SortOption[]>(
    () => ['triage', 'date', 'distance', 'popularity'],
    []
  );

  return (
    <>
      <TouchableOpacity
        style={[styles.pill, !showLabel && styles.pillIconOnly]}
        onPress={() => setOpen(true)}
      >
        <SlidersHorizontal size={16} color={colors.neutral[700]} />
        {showLabel ? <Text style={styles.pillText}>{LABELS[value]}</Text> : null}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Trier par</Text>
          {options.map((option) => {
            const disabled = option === 'distance' && !hasLocation;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.option, disabled && styles.optionDisabled]}
                onPress={() => {
                  if (disabled) return;
                  onChange(option);
                  setOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    value === option && styles.optionTextActive,
                    disabled && styles.optionTextDisabled,
                  ]}
                >
                  {LABELS[option]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.full,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  pillText: {
    ...typography.caption,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  pillIconOnly: {
    paddingHorizontal: spacing.xs,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  sheet: {
    backgroundColor: colors.neutral[0],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  sheetTitle: {
    ...typography.subtitle,
    color: colors.neutral[900],
    marginBottom: spacing.md,
  },
  option: {
    paddingVertical: spacing.sm,
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionText: {
    ...typography.body,
    color: colors.neutral[800],
  },
  optionTextActive: {
    color: colors.primary[700],
    fontWeight: '700',
  },
  optionTextDisabled: {
    color: colors.neutral[500],
  },
});
