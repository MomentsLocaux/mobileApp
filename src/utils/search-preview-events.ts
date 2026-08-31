import { filterEvents } from '@/utils/filter-events';
import { SEARCH_FETCH_LIMIT } from '@/utils/search-helpers';
import type { EventWithCreator } from '@/types/database';
import { fetchDiscoverySearchEvents } from '@/utils/fetch-discovery-search-events';
import {
  toEventFilters,
  toTimeScope,
  type DiscoveryFilters,
} from '@/utils/discovery-filters';

type Coords = { latitude: number; longitude: number };

/** Fetch + filter events for SearchBar preview count (aligned with map viewport / name search). */
export async function fetchSearchPreviewEvents(
  filters: DiscoveryFilters,
  options: {
    searchCenter: Coords | null;
    effectiveRadiusKm?: number;
    userCoords?: Coords | null;
  }
): Promise<EventWithCreator[]> {
  const timeScope = toTimeScope(filters, { searchActive: true });
  const eventFilters = toEventFilters(filters, options.userCoords);
  const constrainToPlace = Boolean(
    filters.place.center ||
      filters.place.label?.trim() ||
      filters.place.radiusKm !== undefined
  );
  const events = await fetchDiscoverySearchEvents({
    nameQuery: eventFilters.name,
    timeScope,
    searchCenter: options.searchCenter,
    effectiveRadiusKm: options.effectiveRadiusKm,
    mergeUpcomingForDatePreset: timeScope === 'current' && !!filters.when.preset,
    limit: SEARCH_FETCH_LIMIT,
    constrainToPlace,
  });

  return filterEvents(
    events,
    constrainToPlace
      ? eventFilters
      : { ...eventFilters, centerLat: undefined, centerLon: undefined, radiusKm: undefined },
    null
  );
}
