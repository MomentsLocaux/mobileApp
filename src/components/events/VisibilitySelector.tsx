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
    color: colors.brand.text,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
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
    backgroundColor: colors.brand.surface,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    ...typography.body,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.brand.text,
  },
});
