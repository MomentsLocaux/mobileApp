import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { EventDetailSection } from '@/components/events/EventDetailSection';
import { colors, spacing, typography } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useEventNearbyPlaces } from '@/hooks/useEventNearbyPlaces';
import { nearbyProviderIsAvailable } from '@/services/nearby/nearby-places-client';
import {
  isValidNearbyCoordinate,
  openOfficialPlaceUrl,
  shouldRevealNearbySection,
  type NearbyPlace,
} from '@/services/nearby/nearby-places';

const PEEK = 48;
const CARD_GAP = spacing.sm;

export type EventNearbySectionHandle = {
  onScroll: (offsetY: number) => void;
};

type Props = {
  enabled: boolean;
  eventId: string;
  latitude: number | null;
  longitude: number | null;
  viewportHeight: number;
  getScrollOffset: () => number;
};

type ViewProps = {
  status: 'loading' | 'success' | 'empty' | 'error';
  places: NearbyPlace[];
  attribution: string | null;
  openingId: string | null;
  openFailed: boolean;
  onRetry: () => void;
  onOpen: (place: NearbyPlace) => void;
};

export const EventNearbySection = forwardRef<EventNearbySectionHandle, Props>(function EventNearbySection({
  enabled,
  eventId,
  latitude,
  longitude,
  viewportHeight,
  getScrollOffset,
}, ref) {
  const anchorRef = useRef<View>(null);
  const anchorY = useRef<number | null>(null);
  const visibleRef = useRef(false);
  const viewportRef = useRef(viewportHeight);
  const scrollOffsetRef = useRef(getScrollOffset);
  const [visible, setVisible] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [openFailed, setOpenFailed] = useState(false);
  const coordinatesValid = isValidNearbyCoordinate(latitude, longitude);
  const providerAvailable = nearbyProviderIsAvailable();

  viewportRef.current = viewportHeight;
  scrollOffsetRef.current = getScrollOffset;

  const reveal = useCallback((scrollY: number) => {
    if (visibleRef.current) return;
    if (!shouldRevealNearbySection(anchorY.current, scrollY, viewportRef.current)) return;
    visibleRef.current = true;
    setVisible(true);
  }, []);

  const measureAnchor = useCallback(() => {
    anchorRef.current?.measureInWindow((_x, y) => {
      if (!Number.isFinite(y)) return;
      anchorY.current = y + scrollOffsetRef.current();
      reveal(scrollOffsetRef.current());
    });
  }, [reveal]);

  useEffect(() => {
    visibleRef.current = false;
    anchorY.current = null;
    setVisible(false);
    setAttempt(0);
    setOpeningId(null);
    setOpenFailed(false);
  }, [eventId]);

  useImperativeHandle(ref, () => ({
    onScroll(offsetY: number) {
      if (!enabled || !coordinatesValid || !providerAvailable) return;
      if (anchorY.current == null) measureAnchor();
      reveal(offsetY);
    },
  }), [coordinatesValid, enabled, measureAnchor, providerAvailable, reveal]);

  const nearby = useEventNearbyPlaces({
    enabled: enabled && coordinatesValid && providerAvailable,
    visible,
    eventId,
    latitude,
    longitude,
    attempt,
  });

  const onOpen = useCallback(async (place: NearbyPlace) => {
    setOpeningId(place.id);
    const outcome = await openOfficialPlaceUrl(place.googleMapsUri, (url) => Linking.openURL(url));
    setOpeningId((current) => (current === place.id ? null : current));
    setOpenFailed(outcome !== 'opened');
  }, []);

  if (!enabled || !coordinatesValid || !providerAvailable) return null;
  if (
    nearby.status === 'idle'
    || nearby.status === 'disabled'
    || nearby.status === 'hidden'
    || nearby.status === 'blocked'
    || nearby.status === 'missing-coordinates'
    || nearby.status === 'aborted'
  ) {
    return (
      <View ref={anchorRef} collapsable={false} onLayout={measureAnchor} />
    );
  }

  return (
    <View ref={anchorRef} collapsable={false} onLayout={measureAnchor}>
      <EventNearbySectionView
        status={nearby.status}
        places={nearby.places}
        attribution={nearby.attribution}
        openingId={openingId}
        openFailed={openFailed}
        onRetry={() => setAttempt((current) => current + 1)}
        onOpen={(place) => { void onOpen(place); }}
      />
    </View>
  );
});

export function EventNearbySectionView({
  status,
  places,
  attribution,
  openingId,
  openFailed,
  onRetry,
  onOpen,
}: ViewProps) {
  const { width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const cardWidth = Math.max(180, width - spacing.lg * 2 - PEEK);
  const showPlaces = status === 'success' && places.length > 0;

  return (
    <EventDetailSection title="À côté">
      <Text style={styles.subtitle}>Un café avant, un repas après ?</Text>
      {status === 'loading' ? (
        <ActivityIndicator
          color={colors.brand.secondary}
          style={styles.spinner}
          accessibilityLabel="Chargement des adresses à proximité"
        />
      ) : null}
      {status === 'empty' ? (
        <Text style={styles.notice}>Aucune adresse trouvée à proximité</Text>
      ) : null}
      {status === 'error' ? (
        <View>
          <Text style={styles.notice}>Les adresses à proximité sont indisponibles.</Text>
          <Pressable
            onPress={onRetry}
            style={styles.retry}
            accessibilityRole="button"
            accessibilityLabel="Réessayer le chargement des adresses à proximité"
          >
            <Text style={styles.retryText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : null}
      {showPlaces ? (
        <ScrollView
          horizontal
          nestedScrollEnabled
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate={reduceMotion ? 'normal' : 'fast'}
          snapToInterval={reduceMotion ? undefined : cardWidth + CARD_GAP}
          snapToAlignment="start"
          disableIntervalMomentum
          contentContainerStyle={styles.row}
          accessibilityLabel="Cafés, bars et restaurants à proximité"
        >
          {places.map((place) => (
            <NearbyPlaceCard
              key={place.id}
              place={place}
              width={cardWidth}
              opening={openingId === place.id}
              onOpen={onOpen}
            />
          ))}
        </ScrollView>
      ) : null}
      {openFailed ? <Text style={styles.notice}>Impossible d’ouvrir la fiche.</Text> : null}
      {showPlaces && attribution ? (
        <View style={styles.attribution} accessibilityLabel={`Attribution ${attribution}`}>
          <Text style={styles.attributionText}>{attribution}</Text>
          {places.flatMap((place) => place.attributions).filter((line, index, all) => all.indexOf(line) === index).map((line) => (
            <Text key={line} style={styles.attributionText}>{line}</Text>
          ))}
        </View>
      ) : null}
    </EventDetailSection>
  );
}

function NearbyPlaceCard({
  place,
  width,
  opening,
  onOpen,
}: {
  place: NearbyPlace;
  width: number;
  opening: boolean;
  onOpen: (place: NearbyPlace) => void;
}) {
  const canOpen = Boolean(place.googleMapsUri);
  return (
    <Pressable
      onPress={() => onOpen(place)}
      disabled={!canOpen || opening}
      style={[styles.card, { width }]}
      accessibilityRole="button"
      accessibilityLabel={`Voir l’établissement ${place.name}`}
      accessibilityState={{ disabled: !canOpen || opening, busy: opening }}
    >
      <View style={styles.body}>
        <Text style={styles.name}>{place.name}</Text>
        {place.categoryLabel ? <Text style={styles.meta}>{place.categoryLabel}</Text> : null}
        {place.distanceLabel ? (
          <Text style={styles.meta} accessibilityLabel={place.distanceLabel}>
            {place.distanceLabel}
          </Text>
        ) : null}
        {canOpen ? <Text style={styles.linkText}>Voir l’établissement</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    marginBottom: spacing.sm,
  },
  spinner: {
    alignSelf: 'flex-start',
    marginVertical: spacing.sm,
  },
  notice: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  retry: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  retryText: {
    ...typography.bodySmall,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  row: {
    gap: CARD_GAP,
    paddingRight: spacing.sm,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brand.line,
    backgroundColor: colors.brand.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  name: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
  meta: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    marginTop: 2,
  },
  linkText: {
    ...typography.bodySmall,
    color: colors.brand.secondary,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  attribution: {
    marginTop: spacing.sm,
    gap: 2,
  },
  attributionText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
});
