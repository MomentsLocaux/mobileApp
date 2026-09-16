import { create } from 'zustand';
import type { EventWithCreator } from '@/types/database';

export const EVENT_PREVIEW_CACHE_LIMIT = 120;

type EventPreviewState = {
  byId: Record<string, EventWithCreator>;
  order: string[];
  rememberEvents: (events: EventWithCreator[]) => void;
  rememberEvent: (event: EventWithCreator) => void;
  getCachedEvent: (id: string) => EventWithCreator | null;
};

const mergeEventPreview = (
  previous: EventWithCreator | undefined,
  next: EventWithCreator,
): EventWithCreator => {
  if (!previous) return next;
  return { ...previous, ...next };
};

export const useEventPreviewStore = create<EventPreviewState>((set, get) => ({
  byId: {},
  order: [],
  rememberEvents: (events) => {
    if (!events.length) return;
    set((state) => {
      const byId = { ...state.byId };
      const incomingIds = new Set(events.map((event) => event.id).filter(Boolean));
      const order = state.order.filter((id) => !incomingIds.has(id));
      for (const event of events) {
        if (!event?.id) continue;
        byId[event.id] = mergeEventPreview(byId[event.id], event);
        order.push(event.id);
      }
      while (order.length > EVENT_PREVIEW_CACHE_LIMIT) {
        const evict = order.shift();
        if (evict) delete byId[evict];
      }
      return { byId, order };
    });
  },
  rememberEvent: (event) => {
    get().rememberEvents([event]);
  },
  getCachedEvent: (id) => get().byId[id] ?? null,
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
