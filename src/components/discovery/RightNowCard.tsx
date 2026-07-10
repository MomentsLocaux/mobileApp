import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Clock, MapPin, Sparkles } from 'lucide-react-native';
import { Button, Card } from '@/components/ui';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import type { RecommendationWithEvent } from '@/services/discovery/discovery-recommendations.service';
import { getEventCardSchedule } from '@/utils/event-card-meta';

type Props = {
  recommendation: RecommendationWithEvent;
  onOpen: () => void;
  onDismiss: () => void;
  onInterested: () => void;
  onRoute: () => void;
};

export function RightNowCard({ recommendation, onOpen, onDismiss, onInterested, onRoute }: Props) {
  const event = recommendation.event;
  if (!event) return null;

  const distanceKm =
    typeof recommendation.context === 'object' &&
    recommendation.context !== null &&
    'distance_km' in recommendation.context
      ? Number((recommendation.context as { distance_km?: number }).distance_km)
      : null;

  return (
    <Card padding="md" style={styles.card}>
      <View style={styles.badgeRow}>
        <Sparkles size={16} color={colors.brand.secondary} />
        <Text style={styles.badge}>Right Now</Text>
      </View>

      <Text style={styles.title}>{event.title}</Text>
      <View style={styles.metaRow}>
        <Clock size={14} color={colors.brand.textSecondary} />
        <Text style={styles.metaText}>{getEventCardSchedule(event, 'compact').start}</Text>
      </View>
      <View style={styles.metaRow}>
        <MapPin size={14} color={colors.brand.textSecondary} />
        <Text style={styles.metaText}>
          {[event.city, event.address].filter(Boolean).join(' · ') || 'Lieu à confirmer'}
        </Text>
      </View>
      {distanceKm != null && Number.isFinite(distanceKm) && (
        <Text style={styles.distance}>À environ {distanceKm.toFixed(1)} km</Text>
      )}

      <View style={styles.actions}>
        <Button title="Voir" onPress={onOpen} fullWidth />
        <View style={styles.secondaryRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={onInterested}>
            <Text style={styles.secondaryText}>Ça m'intéresse</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={onRoute}>
            <Text style={styles.secondaryText}>Itinéraire</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={onDismiss}>
            <Text style={styles.dismissText}>Pas maintenant</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  badge: {
    ...typography.caption,
    color: colors.brand.secondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  title: {
    ...typography.h3,
    color: colors.brand.text,
    marginBottom: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  metaText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    flex: 1,
  },
  distance: {
    ...typography.caption,
    color: colors.brand.secondary,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  secondaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  secondaryButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  secondaryText: {
    ...typography.caption,
    color: colors.brand.text,
    fontWeight: '600',
  },
  dismissText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
});
