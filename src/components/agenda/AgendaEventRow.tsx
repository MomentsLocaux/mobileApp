import React from 'react';
import {
  MapDiscoveryEventCard,
  type MapDiscoveryEventCardProps,
} from '@/components/search/MapDiscoveryEventCard';

/** Agenda lists reuse the map bottom-sheet feed card. */
export function AgendaEventRow(props: Omit<MapDiscoveryEventCardProps, 'variant' | 'active' | 'distance' | 'onHighlight'>) {
  return <MapDiscoveryEventCard {...props} variant="feed" />;
}
