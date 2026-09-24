import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { BrandIcon } from '@/components/ui';
import type { BrandIconName } from '@/components/ui/BrandIcon';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import type { AgendaBucketId } from '@/utils/agenda';

const BUCKET_ICON: Record<AgendaBucketId, BrandIconName> = {
  interested: 'heart',
  participating: 'pin',
  organizing: 'home',
  past: 'calendar',
};

type Props = {
  bucket: AgendaBucketId;
  title: string;
  count: number;
  expanded?: boolean;
  onPress: () => void;
};

export function AgendaBucketRow({ bucket, title, count, expanded = false, onPress }: Props) {
  const Chevron = expanded ? ChevronDown : ChevronRight;
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={`${title} (${count})`}
      accessibilityState={{ expanded }}
      accessibilityHint={expanded ? 'Appuyer pour fermer' : 'Appuyer pour ouvrir'}
    >
      <View style={styles.iconWell}>
        <BrandIcon
          name={BUCKET_ICON[bucket]}
          size={22}
          active={bucket === 'interested' && count > 0}
          color={colors.brand.ink}
        />
      </View>
      <Text style={styles.title}>
        {title} ({count})
      </Text>
      <Chevron size={18} color={colors.brand.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(26, 51, 41, 0.10)',
  },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.surfaceMuted,
  },
  title: {
    ...typography.body,
    flex: 1,
    color: colors.brand.text,
    fontWeight: '600',
  },
});
