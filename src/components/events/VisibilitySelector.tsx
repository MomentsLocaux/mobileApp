import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@/components/ui/v2';

type Props = {
  value: 'public' | 'unlisted';
  onChange: (v: 'public' | 'unlisted') => void;
};

export const VisibilitySelector = ({ value, onChange }: Props) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Visibilité</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.segment, value === 'public' && styles.segmentActive]}
          onPress={() => onChange('public')}
          accessibilityRole="button"
        >
          <Text style={[styles.segmentText, value === 'public' && styles.segmentTextActive]}>Public</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, value === 'unlisted' && styles.segmentActive]}
          onPress={() => onChange('unlisted')}
          accessibilityRole="button"
        >
          <Text style={[styles.segmentText, value === 'unlisted' && styles.segmentTextActive]}>
            Non listé
          </Text>
        </TouchableOpacity>
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
    backgroundColor: colors.surfaceLevel2,
    borderRadius: radius.pill,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.background,
  },
});
