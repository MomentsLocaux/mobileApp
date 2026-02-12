import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar, Eye, Heart, MessageSquare } from 'lucide-react-native';
import { Card } from '@/components/ui';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import type { EventEngagementStats } from '@/types/creator.types';

interface CreatorTopEventsListProps {
  events: EventEngagementStats[];
  onOpenEvent?: (eventId: string) => void;
}

const formatDate = (value?: string | null) => {
  if (!value) return 'Date inconnue';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date inconnue';
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export function CreatorTopEventsList({ events, onOpenEvent }: CreatorTopEventsListProps) {
  if (!events.length) {
    return (
      <Card padding="md" style={styles.emptyCard} elevation="sm">
        <Text style={styles.emptyText}>Aucune donnée d'engagement disponible pour le moment.</Text>
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      {events.map((item, index) => {
        const content = (
          <Card key={item.event_id} padding="md" style={styles.card} elevation="sm">
            <View style={styles.rowTop}>
              <Text style={styles.rank}>#{index + 1}</Text>
              <Text style={styles.title} numberOfLines={1}>
                {item.event?.title || 'Événement'}
              </Text>
              <Text style={styles.score}>{item.engagement_score} pts</Text>
            </View>

            <View style={styles.metaRow}>
              <Calendar size={13} color={colors.neutral[500]} />
              <Text style={styles.metaText}>{formatDate(item.event?.starts_at)}</Text>
              <Text style={styles.metaText}>· {item.event?.city || 'Ville inconnue'}</Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statPill}>
                <Eye size={12} color={colors.info[700]} />
                <Text style={styles.statText}>{item.views_count}</Text>
              </View>
              <View style={styles.statPill}>
                <Heart size={12} color={colors.error[700]} />
                <Text style={styles.statText}>{item.likes_count}</Text>
              </View>
              <View style={styles.statPill}>
                <MessageSquare size={12} color={colors.warning[700]} />
                <Text style={styles.statText}>{item.comments_count}</Text>
              </View>
            </View>
          </Card>
        );

        if (!onOpenEvent) return content;

        return (
          <TouchableOpacity key={item.event_id} activeOpacity={0.85} onPress={() => onOpenEvent(item.event_id)}>
            {content}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
    gap: spacing.xs,
  },
  emptyCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.neutral[600],
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rank: {
    ...typography.bodySmall,
    color: colors.neutral[600],
    fontWeight: '700',
  },
  title: {
    flex: 1,
    ...typography.body,
    color: colors.neutral[900],
    fontWeight: '600',
  },
  score: {
    ...typography.bodySmall,
    color: colors.primary[700],
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    ...typography.caption,
    color: colors.neutral[600],
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.neutral[100],
  },
  statText: {
    ...typography.caption,
    color: colors.neutral[800],
    fontWeight: '600',
  },
});
