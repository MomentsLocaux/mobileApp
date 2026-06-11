import { EventsService } from '@/services/events.service';
import { buildFiltersFromSearch } from '@/utils/search-filters';
import { filterEvents } from '@/utils/filter-events';
import { resolveEventTimeScope } from '@/utils/event-time-scope';
import { SEARCH_FETCH_LIMIT } from '@/utils/search-helpers';
import type { SearchState } from '@/store/searchStore';
import type { EventWithCreator } from '@/types/database';
import { listEventsByBBoxForMap } from '@/utils/bbox-event-fetch';

type Coords = { latitude: number; longitude: number };

/** Fetch + filter events for SearchBar preview count (aligned with map/home search). */
export async function fetchSearchPreviewEvents(
  search: Pick<SearchState, 'where' | 'when' | 'what'>,
  options: {
    searchCenter: Coords | null;
    effectiveRadiusKm?: number;
    userCoords?: Coords | null;
  }
): Promise<EventWithCreator[]> {
  const includePast = search.when.includePast ?? false;
  const timeScope = resolveEventTimeScope({
    metaFilter: 'all',
    searchActive: true,
    includePast,
  });

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

    const featureCollection = await listEventsByBBoxForMap(
      { ne, sw, limit: SEARCH_FETCH_LIMIT },
      timeScope,
      { mergeUpcomingForDatePreset: timeScope === 'current' && !!search.when.preset }
    );
    const ids =
      featureCollection?.features?.map((f: any) => f?.properties?.id).filter(Boolean) || [];
    const uniqueIds = Array.from(new Set(ids)) as string[];
    events = uniqueIds.length ? await EventsService.getEventsByIds(uniqueIds) : [];
  } else {
    events = await EventsService.listEvents({ limit: SEARCH_FETCH_LIMIT, timeScope });
  }

  const filters = buildFiltersFromSearch(
    { ...search, who: { adults: 1, children: 0, babies: 0 } } as SearchState,
    options.userCoords
  );
  return filterEvents(events, filters, null);
}
