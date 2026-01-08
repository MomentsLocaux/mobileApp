import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SlidersHorizontal } from 'lucide-react-native';
import type { SortOption, SortOrder } from '@/types/filters';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';

const LABELS: Record<SortOption, string> = {
  triage: 'Pertinence',
  date: 'Date',
  created: 'Création',
  distance: 'Distance',
  popularity: 'Popularité',
};

interface Props {
  value: SortOption;
  onChange: (value: SortOption) => void;
  sortOrder?: SortOrder;
  onSortOrderChange?: (order: SortOrder) => void;
  hasLocation: boolean;
  showLabel?: boolean;
}

export const TriageControl: React.FC<Props> = ({
  value,
  onChange,
  sortOrder,
  onSortOrderChange,
  hasLocation,
  showLabel = true,
}) => {
  const [open, setOpen] = useState(false);
  const options = useMemo<SortOption[]>(
    () => ['triage', 'date', 'created', 'distance', 'popularity'],
    []
  );
  const showOrder = value === 'date' || value === 'created';
  const orderLabel = sortOrder === 'desc' ? 'Descendant' : 'Ascendant';

  return (
    <>
      <TouchableOpacity
        style={[styles.pill, !showLabel && styles.pillIconOnly]}
        onPress={() => setOpen(true)}
      >
        <SlidersHorizontal size={16} color={colors.neutral[700]} />
        {showLabel ? (
          <Text style={styles.pillText}>
            {LABELS[value]}
            {showOrder && sortOrder ? ` · ${orderLabel}` : ''}
          </Text>
        ) : null}
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
                  if ((option === 'date' || option === 'created') && !sortOrder) {
                    onSortOrderChange?.(option === 'created' ? 'desc' : 'asc');
                  }
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
          {showOrder && onSortOrderChange ? (
            <View style={styles.orderRow}>
              {(['asc', 'desc'] as const).map((order) => (
                <TouchableOpacity
                  key={order}
                  style={[styles.orderChip, sortOrder === order && styles.orderChipActive]}
                  onPress={() => onSortOrderChange(order)}
                >
                  <Text style={[styles.orderText, sortOrder === order && styles.orderTextActive]}>
                    {order === 'asc' ? 'Ascendant' : 'Descendant'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
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
  orderRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  orderChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  orderChipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[300],
  },
  orderText: {
    ...typography.caption,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  orderTextActive: {
    color: colors.primary[700],
  },
});
