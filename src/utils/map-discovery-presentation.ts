import type { EventWithCreator } from '../types/database';
import type { SortOption } from '../types/filters';
import { sortEvents } from './sort-events';

/** Spotlight is a small preview of the same filtered viewport, never a separate feed. */
export function selectMapSpotlight(events: EventWithCreator[], center?: { latitude: number; longitude: number } | null) {
  const seen = new Set<string>();
  return sortEvents(events, 'triage', center).filter((event) => {
    if (event.status !== 'published' || seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  }).slice(0, 3);
}

/** Date headings only accompany a chronological sort; other orders stay intact. */
export function mapEventDateHeading(event: EventWithCreator, previous: EventWithCreator | undefined, sort: SortOption): string | null {
  if (sort !== 'date') return null;
  const date = new Date(event.starts_at);
  if (Number.isNaN(date.getTime())) return previous && Number.isNaN(new Date(previous.starts_at).getTime()) ? null : 'Date à confirmer';
  if (previous && new Date(previous.starts_at).toDateString() === date.toDateString()) return null;
  const label = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Estimate only: variable-height rows must be measured by FlatList before exact scrolling. */
export function estimateMapEventOffset(index: number, averageRowHeight: number, headerHeight: number): number {
  return Math.max(0, headerHeight) + Math.max(0, index) * (averageRowHeight > 0 ? averageRowHeight : 220);
}
