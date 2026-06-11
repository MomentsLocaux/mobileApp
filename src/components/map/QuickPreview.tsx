import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { X } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import type { EventWithCreator } from '../../types/database';
import { EventCard } from '../events/EventCard';

interface QuickPreviewProps {
  event: EventWithCreator;
  onClose: () => void;
  onViewDetails: () => void;
}

export function QuickPreview({ event, onClose, onViewDetails }: QuickPreviewProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <X size={20} color={colors.neutral[600]} />
      </TouchableOpacity>

      <EventCard
        event={event}
        variant="map-preview"
        showCarousel={false}
        noBottomMargin
        onPress={onViewDetails}
        onPrimaryAction={onViewDetails}
        style={styles.card}
      />
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
  card: {
    marginBottom: 0,
    borderWidth: 0,
  },
});
