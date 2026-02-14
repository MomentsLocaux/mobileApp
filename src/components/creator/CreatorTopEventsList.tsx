import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Calendar, Eye, Heart, MessageSquare, Star } from 'lucide-react-native';
import { Badge, Card, Typography, colors, radius, spacing } from '@/components/ui/v2';
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
      <Card padding="md" style={styles.emptyCard}>
        <Typography variant="body" color={colors.textSecondary}>
          Aucune donnée d'engagement disponible pour le moment.
        </Typography>
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      {events.map((item, index) => {
        return (
          <Card
            key={item.event_id}
            padding="md"
            style={styles.card}
            onPress={onOpenEvent ? () => onOpenEvent(item.event_id) : undefined}
          >
            <View style={styles.rowTop}>
              <Badge label={`#${index + 1}`} style={styles.rankBadge} />

              <Typography variant="body" color={colors.textPrimary} weight="700" style={styles.title} numberOfLines={1}>
                {item.event?.title || 'Événement'}
              </Typography>

              <View style={styles.scoreRow}>
                <Star size={12} color={colors.primary} />
                <Typography variant="caption" color={colors.primary} weight="700">
                  {item.engagement_score} pts
                </Typography>
              </View>
            </View>

            <View style={styles.metaRow}>
              <Calendar size={13} color={colors.textSecondary} />
              <Typography variant="caption" color={colors.textSecondary}>
                {formatDate(item.event?.starts_at)}
              </Typography>
              <Typography variant="caption" color={colors.textSecondary}>
                · {item.event?.city || 'Ville inconnue'}
              </Typography>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statPill}>
                <Eye size={12} color={colors.primary} />
                <Typography variant="caption" color={colors.textPrimary} weight="700">
                  {item.views_count}
                </Typography>
              </View>

              <View style={styles.statPill}>
                <Heart size={12} color={colors.primary} />
                <Typography variant="caption" color={colors.textPrimary} weight="700">
                  {item.likes_count}
                </Typography>
              </View>

              <View style={styles.statPill}>
                <MessageSquare size={12} color={colors.primary} />
                <Typography variant="caption" color={colors.textPrimary} weight="700">
                  {item.comments_count}
                </Typography>
              </View>
            </View>
          </Card>
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
    gap: spacing.sm,
  },
  emptyCard: {
    minHeight: 92,
    justifyContent: 'center',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rankBadge: {
    backgroundColor: 'rgba(43, 191, 227, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(43, 191, 227, 0.35)',
  },
  title: {
    flex: 1,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    backgroundColor: colors.surfaceLevel2,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
});
