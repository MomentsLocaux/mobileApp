import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Crown, User as UserIcon } from 'lucide-react-native';
import { Badge, Card, Typography, colors, radius, spacing } from '@/components/ui/v2';
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
      onPress={onPress}
    >
      <View style={styles.left}>
        <Typography variant="caption" color={colors.textSecondary} weight="700" style={styles.rank}>
          {typeof rank === 'number' ? `#${rank}` : '•'}
        </Typography>

        {fan.profile?.avatar_url ? (
          <Image source={{ uri: fan.profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <UserIcon size={16} color={colors.textMuted} />
          </View>
        )}

        <View style={styles.nameWrap}>
          <Typography variant="body" color={colors.textPrimary} weight="700" numberOfLines={1}>
            {fan.profile?.display_name || 'Utilisateur'}
          </Typography>
          <Typography variant="caption" color={colors.textSecondary} numberOfLines={1}>
            Niveau {fan.level} · {fan.interactions_count} interactions
          </Typography>
        </View>
      </View>

      <View style={styles.right}>
        {fan.super_fan ? (
          <Badge
            label="Super fan"
            tone="primary"
            style={styles.superFanBadge}
          />
        ) : null}

        <View style={styles.xpRow}>
          <Crown size={12} color={colors.primary} />
          <Typography variant="caption" color={colors.primary} weight="700">
            {fan.xp} XP
          </Typography>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 78,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  rank: {
    width: 24,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLevel2,
  },
  nameWrap: {
    flex: 1,
    gap: 2,
  },
  right: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    marginLeft: spacing.sm,
  },
  superFanBadge: {
    backgroundColor: 'rgba(43, 191, 227, 0.2)',
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
