import React, { useMemo } from 'react';
import { StyleSheet, Pressable, Dimensions } from 'react-native';
import type { EventWithCreator } from '../../types/database';
import { colors, spacing } from '../../constants/theme';
import { isEventLive } from '../../utils/event-status';
import { EventCard } from '../events/EventCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
export const MAP_RESULT_CARD_WIDTH = Math.min(300, SCREEN_WIDTH * 0.78);
export const MAP_RESULT_CARD_STRIDE = MAP_RESULT_CARD_WIDTH + spacing.sm;

interface Props {
  event: EventWithCreator;
  active?: boolean;
  onPress: () => void;
  onOpenDetails?: () => void;
}

export const MapResultCard: React.FC<Props> = ({ event, active = false, onPress, onOpenDetails }) => {
  useMemo(() => isEventLive(event), [event]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.cardWrap,
        active && styles.cardActive,
        pressed && styles.cardPressed,
      ]}
    >
      <EventCard
        event={event}
        variant="compact"
        showCarousel={false}
        noBottomMargin
        onPress={onPress}
        onPrimaryAction={onOpenDetails ?? onPress}
        onSecondaryAction={onOpenDetails}
        style={styles.card}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  cardWrap: {
    width: MAP_RESULT_CARD_WIDTH,
    marginRight: spacing.sm,
  },
  cardActive: {
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.primary[500],
  },
  cardPressed: {
    opacity: 0.92,
  },
  card: {
    marginBottom: 0,
  },
});
