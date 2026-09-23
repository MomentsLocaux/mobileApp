import React from 'react';
import {
  MapDiscoveryEventCard,
  type MapDiscoveryEventCardProps,
} from '@/components/search/MapDiscoveryEventCard';

/** Agenda bucket lists reuse the map bottom-sheet row card. */
export function AgendaEventRow(props: Omit<MapDiscoveryEventCardProps, 'variant' | 'active' | 'distance' | 'onHighlight'>) {
  return <MapDiscoveryEventCard {...props} variant="row" />;
}
