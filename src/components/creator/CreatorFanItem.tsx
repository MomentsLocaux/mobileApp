import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Star, User as UserIcon } from 'lucide-react-native';
import { Card } from '@/components/ui';
import { borderRadius, colors, minimumTouchTarget, spacing, typography } from '@/constants/theme';
import type { CreatorFan } from '@/types/creator.types';

interface CreatorFanItemProps {
  fan: CreatorFan;
  rank?: number;
  onPress?: () => void;
}

export function CreatorFanItem({ fan, rank, onPress }: CreatorFanItemProps) {
  return (
    <Card
      padding="md"
      style={styles.card}
      elevation="sm"
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`Fan ${fan.profile?.display_name || 'Utilisateur'}, niveau ${fan.level}`}
    >
      <View style={styles.left}>
        <Text style={styles.rank}>{typeof rank === 'number' ? `#${rank}` : '•'}</Text>
        {fan.profile?.avatar_url ? (
          <Image source={{ uri: fan.profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <UserIcon size={16} color={colors.neutral[500]} />
          </View>
        )}
        <View style={styles.nameWrap}>
          <Text style={styles.name} numberOfLines={1}>
            {fan.profile?.display_name || 'Utilisateur'}
          </Text>
          <Text style={styles.meta}>
            Niveau {fan.level} · {fan.interactions_count} interactions
          </Text>
        </View>
      </View>

      <View style={styles.right}>
        {fan.super_fan ? (
          <View style={styles.superFanBadge}>
            <Star size={12} color={colors.warning[700]} />
            <Text style={styles.superFanText}>Super fan</Text>
          </View>
        ) : null}
        <Text style={styles.xp}>{fan.xp} XP</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.secondaryAccent[500],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: minimumTouchTarget + 18,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  rank: {
    ...typography.bodySmall,
    color: colors.textSecondary[500],
    fontWeight: '700',
    width: 24,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background[500],
  },
  nameWrap: {
    flex: 1,
  },
  name: {
    ...typography.body,
    color: colors.textPrimary[500],
    fontWeight: '600',
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary[500],
  },
  right: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  superFanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    backgroundColor: colors.background[500],
  },
  superFanText: {
    ...typography.caption,
    color: colors.warning[700],
    fontWeight: '700',
  },
  xp: {
    ...typography.bodySmall,
    color: colors.primary[700],
    fontWeight: '700',
  },
});
