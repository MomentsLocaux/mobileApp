import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';

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
        >
          <Text style={[styles.segmentText, value === 'public' && styles.segmentTextActive]}>Public</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, value === 'unlisted' && styles.segmentActive]}
          onPress={() => onChange('unlisted')}
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
    color: colors.neutral[900],
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.full,
    padding: spacing.xs,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: colors.neutral[0],
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    ...typography.body,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.primary[700],
  },
});
