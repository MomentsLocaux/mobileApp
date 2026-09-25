import React from 'react';
import { MapDiscoveryEventCard } from '@/components/search/MapDiscoveryEventCard';
import type { EventWithCreator } from '@/types/database';
import { sharePublishedEvent } from '@/utils/event-share';

type Props = {
  event: EventWithCreator;
  distanceLabel?: string | null;
  reason?: string | null;
  hearted: boolean;
  pending?: boolean;
  carousel?: boolean;
  onPress: () => void;
  onToggleHeart: () => void;
};

/** Home listings use the same photo-then-details layout as the map bottom sheet. */
export function HomeEventCard({ event, distanceLabel, reason, hearted, pending, carousel, onPress, onToggleHeart }: Props) {
  return (
    <MapDiscoveryEventCard
      event={event}
      variant="feed"
      carousel={carousel}
      liked={hearted}
      pending={pending}
      distance={distanceLabel}
      badge={reason}
      onOpen={onPress}
      onToggleHeart={onToggleHeart}
      onShare={(item) => { void sharePublishedEvent(item); }}
    />
  );
}
