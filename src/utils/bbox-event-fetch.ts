import { EventsService } from '@/services/events.service';
import { mergeFeatureCollections, type EventMapFeatureCollection } from '@/types/map-events';
import type { EventTimeScope } from '@/utils/event-time-scope';

type BboxParams = {
  ne: [number, number];
  sw: [number, number];
  limit: number;
};

/**
 * Fetches map events in a bbox. When scope is `current` and a date preset is active,
 * also merges upcoming events so weekend/today filters are not starved by the 300-row cap.
 */
export async function listEventsByBBoxForMap(
  bbox: BboxParams,
  timeScope: EventTimeScope,
  options?: { mergeUpcomingForDatePreset?: boolean }
): Promise<EventMapFeatureCollection | null> {
  let collection = (await EventsService.listEventsByBBox({
    ...bbox,
    timeScope,
  })) as EventMapFeatureCollection | null;

  if (timeScope === 'current' && options?.mergeUpcomingForDatePreset) {
    const upcoming = (await EventsService.listEventsByBBox({
      ...bbox,
      timeScope: 'upcoming',
    })) as EventMapFeatureCollection | null;
    collection = mergeFeatureCollections(collection, upcoming);
  }

  return collection;
}
