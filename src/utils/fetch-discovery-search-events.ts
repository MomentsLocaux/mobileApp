import { EventsService } from '@/services/events.service';
import type { EventWithCreator } from '@/types/database';
import { listMapViewportForMap } from '@/utils/bbox-event-fetch';
import { tokenizeNameQuery } from '@/utils/event-name-search';
import { getBoundsFromRadiusKm, SEARCH_FETCH_LIMIT } from '@/utils/search-helpers';
import type { EventTimeScope } from '@/utils/event-time-scope';

type Coords = { latitude: number; longitude: number };

type Bbox = { ne: [number, number]; sw: [number, number] };

export function mergeEventsById(...lists: EventWithCreator[][]): EventWithCreator[] {
  const byId = new Map<string, EventWithCreator>();
  for (const list of lists) {
    for (const event of list) {
      if (event?.id) byId.set(event.id, event);
    }
  }
  return Array.from(byId.values());
}

export async function listEventsByNameQuery(options: {
  nameQuery: string;
  timeScope: EventTimeScope;
  limit?: number;
  bbox?: Bbox;
}): Promise<EventWithCreator[]> {
  if (tokenizeNameQuery(options.nameQuery).length === 0) return [];
  return EventsService.listEvents({
    limit: options.limit ?? SEARCH_FETCH_LIMIT,
    timeScope: options.timeScope,
    nameQuery: options.nameQuery,
    bbox: options.bbox,
  });
}

/**
 * Home / SearchBar preview: viewport RPC for place-only searches,
 * plus a title/description `ilike` fetch when the user typed keywords in Quoi.
 */
export async function fetchDiscoverySearchEvents(options: {
  nameQuery?: string | null;
  timeScope: EventTimeScope;
  searchCenter?: Coords | null;
  effectiveRadiusKm?: number;
  mergeUpcomingForDatePreset?: boolean;
  limit?: number;
  /** When false, a keyword search is not clipped to the current place bbox. */
  constrainToPlace?: boolean;
}): Promise<EventWithCreator[]> {
  const limit = options.limit ?? SEARCH_FETCH_LIMIT;
  const tokens = tokenizeNameQuery(options.nameQuery || '');
  const placeBbox =
    options.searchCenter && options.effectiveRadiusKm
      ? getBoundsFromRadiusKm(
          options.searchCenter.latitude,
          options.searchCenter.longitude,
          options.effectiveRadiusKm
        )
      : undefined;
  const bbox = options.constrainToPlace === false ? undefined : placeBbox;

  if (tokens.length > 0) {
    return listEventsByNameQuery({
      nameQuery: options.nameQuery || '',
      timeScope: options.timeScope,
      limit,
      bbox,
    });
  }

  if (placeBbox) {
    const viewport = await listMapViewportForMap({ ...placeBbox, limit }, options.timeScope, {
      mergeUpcomingForDatePreset: options.mergeUpcomingForDatePreset,
    });
    return viewport.events || [];
  }

  return EventsService.listEvents({ limit, timeScope: options.timeScope });
}
