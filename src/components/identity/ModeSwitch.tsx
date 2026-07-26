import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Compass, PlusCircle } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { identityAccents } from '@/constants/identityTheme';
import type { ActiveMode } from '@/constants/accountIdentity';
import { haptics } from '@/utils/haptics';

type Props = {
  mode: ActiveMode;
  loading?: boolean;
  onChange: (mode: ActiveMode) => void;
};

export function ModeSwitch({ mode, loading, onChange }: Props) {
  const select = (next: ActiveMode) => {
    if (loading || next === mode) return;
    haptics.selection();
    onChange(next);
  };

  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      <Text style={styles.caption}>Mode</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[
            styles.chip,
            mode === 'discover' && {
              backgroundColor: identityAccents.discover.accentMuted,
              borderColor: identityAccents.discover.accentBorder,
            },
          ]}
          onPress={() => select('discover')}
          disabled={loading}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'discover' }}
          accessibilityLabel="Mode Découvreur"
        >
          <Compass
            size={16}
            color={mode === 'discover' ? identityAccents.discover.accent : colors.brand.textSecondary}
          />
          <Text
            style={[
              styles.chipLabel,
              mode === 'discover' && { color: identityAccents.discover.accent },
            ]}
          >
            Découvreur
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.chip,
            mode === 'create' && {
              backgroundColor: identityAccents.create.accentMuted,
              borderColor: identityAccents.create.accentBorder,
            },
          ]}
          onPress={() => select('create')}
          disabled={loading}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'create' }}
          accessibilityLabel="Mode Créateur"
        >
          <PlusCircle
            size={16}
            color={mode === 'create' ? identityAccents.create.accent : colors.brand.textSecondary}
          />
          <Text
            style={[
              styles.chipLabel,
              mode === 'create' && { color: identityAccents.create.accent },
            ]}
          >
            Créateur
          </Text>
        </TouchableOpacity>
        {loading ? <ActivityIndicator size="small" color={colors.brand.secondary} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  caption: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    minHeight: 40,
  },
  chipLabel: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.brand.textSecondary,
  },
});
