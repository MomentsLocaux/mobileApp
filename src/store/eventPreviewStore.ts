import { create } from 'zustand';
import type { EventWithCreator } from '@/types/database';
import {
  EMPTY_EVENT_CACHE,
  EVENT_CACHE_BULK_LIMIT,
  EVENT_PREVIEW_CACHE_LIMIT,
  eventsFromCache,
  pinOpenedEventIntoCache,
  pinVisibleEventsIntoCache,
  rememberEventsIntoCache,
  type EventCachePinSurface,
  type EventCacheSnapshot,
} from './eventCache';

export { EVENT_CACHE_BULK_LIMIT, EVENT_PREVIEW_CACHE_LIMIT };
export {
  mergeCachedEvent,
  mergeCachedEvent as mergeEventPreview,
} from './eventCache';

type EventPreviewState = EventCacheSnapshot & {
  rememberEvents: (events: EventWithCreator[]) => void;
  rememberEvent: (event: EventWithCreator) => void;
  pinVisibleEvents: (surface: EventCachePinSurface, ids: string[]) => void;
  pinOpenedEvent: (id: string | null) => void;
  prepareEventDetail: (event: EventWithCreator) => void;
  getCachedEvent: (id: string) => EventWithCreator | null;
  getCachedEvents: (ids: string[]) => EventWithCreator[];
};

export const useEventPreviewStore = create<EventPreviewState>((set, get) => ({
  ...EMPTY_EVENT_CACHE,
  rememberEvents: (events) => {
    if (!events.length) return;
    set((state) => rememberEventsIntoCache(state, events));
  },
  rememberEvent: (event) => {
    get().rememberEvents([event]);
  },
  pinVisibleEvents: (surface, ids) => {
    set((state) => pinVisibleEventsIntoCache(state, surface, ids));
  },
  pinOpenedEvent: (id) => {
    set((state) => pinOpenedEventIntoCache(state, id));
  },
  prepareEventDetail: (event) => {
    if (!event?.id) return;
    set((state) =>
      pinOpenedEventIntoCache(rememberEventsIntoCache(state, [event]), event.id),
    );
  },
  getCachedEvent: (id) => get().byId[id] ?? null,
  getCachedEvents: (ids) => eventsFromCache(get(), ids),
}));

export function resolveSeededEventDetail(options: {
  eventId?: string;
  origin?: string;
  mapEventId?: string;
  mapOrigin?: string;
  mapEvent?: EventWithCreator | null;
}): EventWithCreator | null {
  const eventId = options.eventId;
  if (!eventId) return null;
  if (
    (options.origin === 'map-unit' || options.origin === 'map-sheet') &&
    options.mapOrigin === options.origin &&
    options.mapEventId === eventId &&
    options.mapEvent
  ) {
    return options.mapEvent;
  }
  return useEventPreviewStore.getState().getCachedEvent(eventId);
}

export function prepareEventDetail(event: EventWithCreator): void {
  useEventPreviewStore.getState().prepareEventDetail(event);
}

export function resolveCachedMapEvent(
  eventId: string,
  lists: (Iterable<EventWithCreator> | null | undefined)[],
): EventWithCreator | null {
  const preview = useEventPreviewStore.getState().getCachedEvent(eventId);
  if (preview) return preview;
  for (const list of lists) {
    if (!list) continue;
    for (const event of list) {
      if (event.id === eventId) return event;
    }
  }
  return null;
}
