import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Activity, CheckCircle2, Eye, Heart, MessageSquare, Users } from 'lucide-react-native';
import { CreatorStatsCard } from '@/components/creator/CreatorStatsCard';
import { colors, spacing } from '@/constants/theme';
import type { CreatorEngagementStats } from '@/types/creator.types';

interface CreatorKpiRowProps {
  stats: CreatorEngagementStats | null;
  onPressKpi?: (key: string) => void;
}

const toNumber = (value: number | null | undefined) => Number(value ?? 0);
const CARD_WIDTH = 182;

export function CreatorKpiRow({ stats, onPressKpi }: CreatorKpiRowProps) {
  const safe = stats ?? {
    creator_id: '',
    total_events: 0,
    total_views: 0,
    total_likes: 0,
    total_comments: 0,
    total_followers: 0,
    total_checkins: 0,
    engagement_score: 0,
  };

  return (
    <ScrollView
      horizontal
      decelerationRate="fast"
      showsHorizontalScrollIndicator={false}
      snapToInterval={CARD_WIDTH + spacing.sm}
      snapToAlignment="start"
      contentContainerStyle={styles.content}
    >
      <CreatorStatsCard
        label="Score"
        value={toNumber(safe.engagement_score)}
        helper="Engagement global"
        icon={<Activity size={14} color={colors.primary[700]} />}
        onPress={() => onPressKpi?.('engagement_score')}
      />
      <CreatorStatsCard
        label="Événements"
        value={toNumber(safe.total_events)}
        helper="Total créés"
        icon={<CheckCircle2 size={14} color={colors.primary[700]} />}
        onPress={() => onPressKpi?.('total_events')}
      />
      <CreatorStatsCard
        label="Vues"
        value={toNumber(safe.total_views)}
        icon={<Eye size={14} color={colors.primary[700]} />}
        onPress={() => onPressKpi?.('total_views')}
      />
      <CreatorStatsCard
        label="Likes"
        value={toNumber(safe.total_likes)}
        icon={<Heart size={14} color={colors.primary[700]} />}
        onPress={() => onPressKpi?.('total_likes')}
      />
      <CreatorStatsCard
        label="Commentaires"
        value={toNumber(safe.total_comments)}
        icon={<MessageSquare size={14} color={colors.primary[700]} />}
        onPress={() => onPressKpi?.('total_comments')}
      />
      <CreatorStatsCard
        label="Followers"
        value={toNumber(safe.total_followers)}
        icon={<Users size={14} color={colors.primary[700]} />}
        onPress={() => onPressKpi?.('total_followers')}
      />
      <CreatorStatsCard
        label="Check-ins"
        value={toNumber(safe.total_checkins)}
        icon={<CheckCircle2 size={14} color={colors.primary[700]} />}
        onPress={() => onPressKpi?.('total_checkins')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
});
