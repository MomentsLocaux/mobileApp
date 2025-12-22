import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { X, MapPin, Calendar, Heart } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { getCategoryLabel } from '../../constants/categories';
import type { EventWithCreator } from '../../types/database';

interface QuickPreviewProps {
  event: EventWithCreator;
  onClose: () => void;
  onViewDetails: () => void;
}

export function QuickPreview({ event, onClose, onViewDetails }: QuickPreviewProps) {
  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <X size={20} color={colors.neutral[600]} />
      </TouchableOpacity>

      {event.cover_url ? (
        <Image source={{ uri: event.cover_url }} style={styles.cover} />
      ) : null}

      <View style={styles.content}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{getCategoryLabel(event.category || '')}</Text>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>

        <View style={styles.infoRow}>
          <MapPin size={14} color={colors.neutral[600]} />
          <Text style={styles.infoText} numberOfLines={1}>
            {event.address}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Calendar size={14} color={colors.neutral[600]} />
          <Text style={styles.infoText}>{formatDate(event.starts_at)}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.statsRow}>
            <Heart size={14} color={colors.error[500]} />
            <Text style={styles.statsText}>{event.interests_count}</Text>
          </View>

          <TouchableOpacity style={styles.viewButton} onPress={onViewDetails}>
            <Text style={styles.viewButtonText}>Voir la fiche</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    maxWidth: 320,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      },
      default: {
        shadowColor: colors.neutral[900],
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
      },
    }),
  },
  closeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 10,
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.full,
    padding: spacing.xs,
  },
  cover: {
    width: '100%',
    height: 120,
    backgroundColor: colors.neutral[200],
  },
  content: {
    padding: spacing.md,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  categoryText: {
    ...typography.caption,
    color: colors.primary[700],
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  title: {
    ...typography.h4,
    color: colors.neutral[900],
    marginBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.neutral[600],
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statsText: {
    ...typography.bodySmall,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  viewButton: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  viewButtonText: {
    ...typography.bodySmall,
    color: colors.neutral[0],
    fontWeight: '600',
  },
});
