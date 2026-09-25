import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DiscoveryLoadingState } from '@/components/ui/DiscoveryLoadingState';
import { BrandIcon } from '@/components/ui/BrandIcon';
import { DISCOVERY_MIN_RADIUS_KM, DISCOVERY_RADIUS_STEP_KM, HOME_NEARBY_MAX_RADIUS_KM } from '@/constants/filters';
import { colors, spacing, typography } from '@/constants/theme';
import type { EventWithCreator } from '@/types/database';
import { emptyHomeSlotCopy, mapMomentsCta, type HomeTimeSlot } from '@/utils/home-feed';
import { HomeEventCard } from './HomeEventCard';
import { HomeTimeSelector } from './HomeTimeSelector';

type Props = {
  slot: HomeTimeSlot;
  events: EventWithCreator[];
  totalCount: number;
  complete: boolean;
  loading: boolean;
  error: string | null;
  zoneLabel: string;
  radiusKm: number;
  onRadiusChange: (radiusKm: number) => void;
  reasonFor: (event: EventWithCreator) => string | null;
  pendingHearts: ReadonlySet<string>;
  onRetry: () => void;
  distanceLabelFor: (event: EventWithCreator) => string | null;
  isHearted: (eventId: string) => boolean;
  canWiden: boolean;
  showNextDays: boolean;
  onSlotChange: (slot: HomeTimeSlot) => void;
  onPressEvent: (event: EventWithCreator) => void;
  onToggleHeart: (event: EventWithCreator) => void;
  onOpenMap: () => void;
  onWiden: () => void;
  onNextDays: () => void;
};

export function NearbyMomentsSection({
  slot,
  events,
  totalCount, complete, loading, error, zoneLabel, radiusKm, onRadiusChange, reasonFor, pendingHearts, onRetry,
  distanceLabelFor,
  isHearted,
  canWiden,
  showNextDays,
  onSlotChange,
  onPressEvent,
  onToggleHeart,
  onOpenMap,
  onWiden,
  onNextDays,
}: Props) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Autour de toi</Text>
      <View style={styles.radiusRow}>
        <Text style={styles.zone}>{zoneLabel}</Text>
        <View style={styles.radiusControls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Réduire le rayon"
            disabled={radiusKm <= DISCOVERY_MIN_RADIUS_KM}
            onPress={() => onRadiusChange(radiusKm - DISCOVERY_RADIUS_STEP_KM)}
            style={[styles.radiusButton, radiusKm <= DISCOVERY_MIN_RADIUS_KM && styles.radiusButtonDisabled]}
          >
            <Text style={styles.radiusButtonLabel}>−</Text>
          </Pressable>
          <Text style={styles.radiusValue}>{radiusKm} km</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Augmenter le rayon"
            disabled={radiusKm >= HOME_NEARBY_MAX_RADIUS_KM}
            onPress={() => onRadiusChange(radiusKm + DISCOVERY_RADIUS_STEP_KM)}
            style={[styles.radiusButton, radiusKm >= HOME_NEARBY_MAX_RADIUS_KM && styles.radiusButtonDisabled]}
          >
            <Text style={styles.radiusButtonLabel}>+</Text>
          </Pressable>
        </View>
      </View>
      <HomeTimeSelector value={slot} onChange={onSlotChange} />
      {error ? <View style={styles.empty}><Text style={styles.zone}>{error}</Text><Pressable accessibilityRole="button" onPress={onRetry} style={styles.secondary}><Text style={styles.secondaryLabel}>Réessayer</Text></Pressable></View> : null}
      {loading && events.length === 0 ? <DiscoveryLoadingState title="On regarde autour de toi" subtitle="On prépare quelques idées de sortie." /> : events.length > 0 ? (
        <View>
          <ScrollView key={slot} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {events.map((event) => (
              <HomeEventCard
                key={event.id}
                event={event}
                reason={reasonFor(event)}
                pending={pendingHearts.has(event.id)}
                distanceLabel={distanceLabelFor(event)}
                hearted={isHearted(event.id)}
                onPress={() => onPressEvent(event)}
                onToggleHeart={() => onToggleHeart(event)}
              />
            ))}
          </ScrollView>

        </View>
      ) : !error ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{totalCount > 0 ? 'Ton moment pour cette période est dans ton agenda, juste au-dessus.' : emptyHomeSlotCopy(slot, complete)}</Text>
          <View style={styles.emptyActions}>
            {canWiden ? (
              <Pressable accessibilityRole="button" onPress={onWiden} style={styles.secondary}>
                <Text style={styles.secondaryLabel}>Élargir la zone</Text>
              </Pressable>
            ) : null}
            {showNextDays ? (
              <Pressable accessibilityRole="button" onPress={onNextDays} style={styles.secondary}>
                <Text style={styles.secondaryLabel}>Voir les prochains jours</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={mapMomentsCta(totalCount, complete)}
            onPress={onOpenMap}
            style={styles.cta}
          >
            <BrandIcon name="map" size={22} />
            <Text style={styles.ctaLabel}>{mapMomentsCta(totalCount, complete)}</Text>
          </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
    paddingLeft: spacing.lg,
  },
  zone: { ...typography.caption, color: colors.brand.textSecondary, flex: 1 },
  radiusRow: {
    marginRight: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  radiusControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  radiusButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusButtonDisabled: { opacity: 0.4 },
  radiusButtonLabel: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
  radiusValue: {
    ...typography.caption,
    color: colors.brand.text,
    fontWeight: '700',
    minWidth: 52,
    textAlign: 'center',
  },
  title: {
    ...typography.h4,
    color: colors.brand.text,
  },
  row: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  cta: {
    marginRight: spacing.lg,
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: colors.brand.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  ctaLabel: {
    ...typography.bodySmall,
    fontWeight: '700',
    flexShrink: 1,
    color: colors.brand.onAccent,
    textAlign: 'center',
  },
  empty: {
    marginRight: spacing.lg,
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  emptyTitle: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
  emptyActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  secondary: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.brand.surfaceMuted,
  },
  secondaryLabel: {
    ...typography.label,
    color: colors.brand.text,
  },
});
