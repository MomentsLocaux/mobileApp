import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRight, MapPin } from 'lucide-react-native';
import { Card } from '@/components/ui';
import { colors, spacing, typography } from '@/constants/theme';
import type { RecommendationWithEvent } from '@/services/discovery/discovery-recommendations.service';
import { getEventCardSchedule } from '@/utils/event-card-meta';

type Props = {
  items: RecommendationWithEvent[];
  onPress: (item: RecommendationWithEvent) => void;
};

export function ForYouList({ items, onPress }: Props) {
  if (items.length === 0) {
    return (
      <Card padding="md">
        <Text style={styles.emptyTitle}>Pour vous</Text>
        <Text style={styles.emptyBody}>
          Explorez la carte et marquez vos intérêts pour affiner vos suggestions.
        </Text>
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Pour vous</Text>
      {items.map((item) => {
        const event = item.event;
        if (!event) return null;

        return (
          <TouchableOpacity key={item.id} onPress={() => onPress(item)} activeOpacity={0.85}>
            <Card padding="md" style={styles.row}>
              <View style={styles.rowContent}>
                <Text style={styles.title} numberOfLines={2}>
                  {event.title}
                </Text>
                <Text style={styles.meta}>{getEventCardSchedule(event, 'compact').start}</Text>
                <View style={styles.locationRow}>
                  <MapPin size={12} color={colors.brand.textSecondary} />
                  <Text style={styles.location} numberOfLines={1}>
                    {event.city || event.address || 'Lieu à confirmer'}
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color={colors.brand.textSecondary} />
            </Card>
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
  sectionTitle: {
    ...typography.h3,
    color: colors.brand.text,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  rowContent: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  title: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  meta: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginBottom: spacing.xs,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  location: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    flex: 1,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.brand.text,
    marginBottom: spacing.xs,
  },
  emptyBody: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
});
