import React from 'react';
import { AgendaSwipeAction, type OnAgendaSwipeStart } from './AgendaSwipeAction';
import {
  MapDiscoveryEventCard,
  type MapDiscoveryEventCardProps,
} from '@/components/search/MapDiscoveryEventCard';

/** Agenda lists reuse the map bottom-sheet feed card. */
type Props = Omit<MapDiscoveryEventCardProps, 'variant' | 'active' | 'distance' | 'onHighlight'> & {
  onRemove?: MapDiscoveryEventCardProps['onToggleHeart'];
  onSwipeStart?: OnAgendaSwipeStart;
};

export function AgendaEventRow({ onRemove, onSwipeStart, ...props }: Props) {
  const card = <MapDiscoveryEventCard {...props} variant="feed" />;
  if (!props.liked || !onRemove || !onSwipeStart) return card;
  return (
    <AgendaSwipeAction title={props.event.title} pending={!!props.pending}
      onRemove={() => onRemove(props.event)} onSwipeStart={onSwipeStart}>
      {card}
    </AgendaSwipeAction>
  );
}
