import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { X, List } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/components/ui/v2/theme';
import type { EventWithCreator } from '../../types/database';

interface ClusterPreviewProps {
  events: EventWithCreator[];
  isTruncated?: boolean;
  onClose: () => void;
  onViewInList: () => void;
  onSelectEvent: (eventId: string) => void;
}

export function ClusterPreview({
  events,
  isTruncated = false,
  onClose,
  onViewInList,
  onSelectEvent,
}: ClusterPreviewProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {events.length} événement{events.length > 1 ? 's' : ''} dans cette zone
        </Text>
        <TouchableOpacity onPress={onClose}>
          <X size={20} color={colors.scale.neutral[600]} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {events.map((event) => (
          <TouchableOpacity
            key={event.id}
            style={styles.eventItem}
            onPress={() => onSelectEvent(event.id)}
          >
            <View style={styles.eventInfo}>
              <Text style={styles.eventTitle} numberOfLines={2}>
                {event.title}
              </Text>
              <Text style={styles.eventAddress} numberOfLines={1}>
                {event.address}
              </Text>
            </View>
            <View style={styles.arrow}>
              <Text style={styles.arrowText}>→</Text>
            </View>
          </TouchableOpacity>
        ))}

        {isTruncated && (
          <View style={styles.truncatedNotice}>
            <Text style={styles.truncatedText}>
              Liste tronquée... Utilisez la vue liste pour voir tous les événements.
            </Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.viewListButton} onPress={onViewInList}>
        <List size={18} color={colors.scale.primary[600]} />
        <Text style={styles.viewListText}>Voir dans la liste</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.scale.neutral[0],
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    maxWidth: 320,
    maxHeight: 400,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      },
      default: {
        shadowColor: colors.scale.neutral[900],
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.scale.neutral[200],
  },
  title: {
    ...typography.bodyLarge,
    color: colors.scale.neutral[900],
    fontWeight: '600',
    flex: 1,
  },
  list: {
    maxHeight: 250,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.scale.neutral[100],
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    ...typography.body,
    color: colors.scale.neutral[900],
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  eventAddress: {
    ...typography.bodySmall,
    color: colors.scale.neutral[600],
  },
  arrow: {
    marginLeft: spacing.sm,
  },
  arrowText: {
    ...typography.h4,
    color: colors.scale.primary[600],
  },
  truncatedNotice: {
    padding: spacing.md,
    backgroundColor: colors.scale.warning[50],
    borderTopWidth: 1,
    borderTopColor: colors.scale.warning[200],
  },
  truncatedText: {
    ...typography.bodySmall,
    color: colors.scale.warning[700],
    textAlign: 'center',
  },
  viewListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.scale.primary[50],
    borderTopWidth: 1,
    borderTopColor: colors.scale.primary[100],
  },
  viewListText: {
    ...typography.body,
    color: colors.scale.primary[700],
    fontWeight: '600',
  },
});
