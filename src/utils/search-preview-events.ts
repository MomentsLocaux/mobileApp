import { EventsService } from '@/services/events.service';
import { filterEvents } from '@/utils/filter-events';
import { SEARCH_FETCH_LIMIT } from '@/utils/search-helpers';
import type { EventWithCreator } from '@/types/database';
import { listMapViewportForMap } from '@/utils/bbox-event-fetch';
import {
  toEventFilters,
  toTimeScope,
  type DiscoveryFilters,
} from '@/utils/discovery-filters';

type Coords = { latitude: number; longitude: number };

/** Fetch + filter events for SearchBar preview count (aligned with map viewport RPC). */
export async function fetchSearchPreviewEvents(
  filters: DiscoveryFilters,
  options: {
    searchCenter: Coords | null;
    effectiveRadiusKm?: number;
    userCoords?: Coords | null;
  }
): Promise<EventWithCreator[]> {
  const timeScope = toTimeScope(filters, { searchActive: true });

  let events: EventWithCreator[] = [];

  if (options.searchCenter && options.effectiveRadiusKm !== undefined) {
    const latDelta = options.effectiveRadiusKm / 111;
    const lonDelta =
      options.effectiveRadiusKm /
      (111 * Math.max(Math.cos((options.searchCenter.latitude * Math.PI) / 180), 0.1));
    const ne: [number, number] = [
      options.searchCenter.longitude + lonDelta,
      options.searchCenter.latitude + latDelta,
    ];
    const sw: [number, number] = [
      options.searchCenter.longitude - lonDelta,
      options.searchCenter.latitude - latDelta,
    ];

    const viewport = await listMapViewportForMap(
      { ne, sw, limit: SEARCH_FETCH_LIMIT },
      timeScope,
      { mergeUpcomingForDatePreset: timeScope === 'current' && !!filters.when.preset }
    );
    events = viewport.events || [];
  } else {
    events = await EventsService.listEvents({ limit: SEARCH_FETCH_LIMIT, timeScope });
  }

  const eventFilters = toEventFilters(filters, options.userCoords);
  return filterEvents(events, eventFilters, null);
}
