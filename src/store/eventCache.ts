import type { EventMedia, EventWithCreator } from '@/types/database';

/** Unpinned LRU cap. Pinned ids (visible + opened) are never evicted by bulk ingest. */
export const EVENT_CACHE_BULK_LIMIT = 400;
/** @deprecated Use EVENT_CACHE_BULK_LIMIT. Kept for existing call sites/tests. */
export const EVENT_PREVIEW_CACHE_LIMIT = EVENT_CACHE_BULK_LIMIT;
export const EVENT_CACHE_PIN_LIMIT = 300;
export const EVENT_CACHE_PERSIST_LIMIT = 200;
export const EVENT_CACHE_DESCRIPTION_PERSIST_CHARS = 280;

const EMPTY_URL_TOKENS = new Set(['null', 'undefined', 'none', '']);

export type EventCachePinSurface = 'home' | 'home-view' | 'map-sheet' | 'map-nearby' | 'proposals';

export type EventCacheSnapshot = {
  byId: Record<string, EventWithCreator>;
  order: string[];
  pinnedBySurface: Partial<Record<EventCachePinSurface, string[]>>;
  openedId: string | null;
  epoch: number;
};

export const EMPTY_EVENT_CACHE: EventCacheSnapshot = {
  byId: {},
  order: [],
  pinnedBySurface: {},
  openedId: null,
  epoch: 0,
};

export function isUsableMediaUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !EMPTY_URL_TOKENS.has(trimmed.toLowerCase());
}

const keepExistingUrl = (previous: unknown, next: unknown): string | null => {
  if (isUsableMediaUrl(previous)) return previous;
  if (isUsableMediaUrl(next)) return next;
  return null;
};

export function mergeEventMedia(
  previous: EventMedia[] | null | undefined,
  next: EventMedia[] | null | undefined,
): EventMedia[] {
  const incoming = Array.isArray(next) ? next : [];
  const existing = Array.isArray(previous) ? previous : [];
  if (!incoming.length) return existing;
  if (!existing.length) return incoming;

  const order: EventMedia[] = [];
  const byId = new Map<string, EventMedia>();
  const byUrl = new Map<string, EventMedia>();

  const indexOf = (item: EventMedia) => {
    const idx = order.findIndex((candidate) => candidate === item);
    return idx;
  };

  const ingest = (item: EventMedia) => {
    if (!item) return;
    const matched =
      (item.id ? byId.get(item.id) : undefined) ||
      (isUsableMediaUrl(item.url) ? byUrl.get(item.url) : undefined);
    if (!matched) {
      order.push(item);
      if (item.id) byId.set(item.id, item);
      if (isUsableMediaUrl(item.url)) byUrl.set(item.url, item);
      return;
    }
    const merged: EventMedia = {
      ...matched,
      ...item,
      url: keepExistingUrl(matched.url, item.url) ?? matched.url,
    };
    const idx = indexOf(matched);
    if (idx >= 0) order[idx] = merged;
    if (merged.id) byId.set(merged.id, merged);
    if (isUsableMediaUrl(merged.url)) byUrl.set(merged.url, merged);
  };

  existing.forEach(ingest);
  incoming.forEach(ingest);
  return order;
}

export function mergeCachedEvent(
  previous: EventWithCreator | undefined,
  next: EventWithCreator,
): EventWithCreator {
  if (!previous) return next;
  const merged: EventWithCreator = {
    ...previous,
    ...next,
    cover_url: keepExistingUrl(previous.cover_url, next.cover_url),
    media: mergeEventMedia(previous.media, next.media),
  };
  if (previous.description && !next.description) {
    merged.description = previous.description;
  }
  return merged;
}

export function eventHeroIdentity(event: Pick<EventWithCreator, 'id' | 'cover_url' | 'media' | 'title'>): string {
  const mediaUrls = (event.media || []).map((item) => item.url).join('|');
  return `${event.id}::${event.cover_url ?? ''}::${mediaUrls}::${event.title}`;
}

export function collectPinnedIds(state: EventCacheSnapshot): Set<string> {
  const pinned = new Set<string>();
  for (const ids of Object.values(state.pinnedBySurface)) {
    if (!ids) continue;
    for (const id of ids) {
      if (id) pinned.add(id);
    }
  }
  if (state.openedId) pinned.add(state.openedId);
  return pinned;
}

function capIds(ids: string[], limit: number): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    next.push(id);
    if (next.length >= limit) break;
  }
  return next;
}

export function rememberEventsIntoCache(
  state: EventCacheSnapshot,
  events: EventWithCreator[],
): EventCacheSnapshot {
  if (!events.length) return state;
  const byId = { ...state.byId };
  const incomingIds = new Set(events.map((event) => event.id).filter(Boolean));
  const order = state.order.filter((id) => !incomingIds.has(id));
  for (const event of events) {
    if (!event?.id) continue;
    byId[event.id] = mergeCachedEvent(byId[event.id], event);
    order.push(event.id);
  }

  const pinned = collectPinnedIds({ ...state, byId, order });
  const unpinned = order.filter((id) => !pinned.has(id));
  const keptUnpinned =
    unpinned.length > EVENT_CACHE_BULK_LIMIT
      ? unpinned.slice(unpinned.length - EVENT_CACHE_BULK_LIMIT)
      : unpinned;
  const keptUnpinnedSet = new Set(keptUnpinned);
  const nextOrder = order.filter((id) => pinned.has(id) || keptUnpinnedSet.has(id));
  for (const id of Object.keys(byId)) {
    if (!pinned.has(id) && !keptUnpinnedSet.has(id)) {
      delete byId[id];
    }
  }

  return {
    ...state,
    byId,
    order: nextOrder,
    epoch: state.epoch + 1,
  };
}

export function pinVisibleEventsIntoCache(
  state: EventCacheSnapshot,
  surface: EventCachePinSurface,
  ids: string[],
): EventCacheSnapshot {
  return {
    ...state,
    pinnedBySurface: {
      ...state.pinnedBySurface,
      [surface]: capIds(ids, EVENT_CACHE_PIN_LIMIT),
    },
    epoch: state.epoch + 1,
  };
}

export function pinOpenedEventIntoCache(
  state: EventCacheSnapshot,
  id: string | null,
): EventCacheSnapshot {
  if (state.openedId === id) return state;
  return {
    ...state,
    openedId: id,
    epoch: state.epoch + 1,
  };
}

export function toPersistedEventCard(event: EventWithCreator): EventWithCreator {
  const description = event.description
    ? event.description.slice(0, EVENT_CACHE_DESCRIPTION_PERSIST_CHARS)
    : event.description;
  return {
    ...event,
    description,
    media: Array.isArray(event.media)
      ? event.media.map((item) => ({
          id: item.id,
          event_id: item.event_id,
          url: item.url,
          type: item.type,
          order: item.order,
          created_at: item.created_at,
        }))
      : [],
  };
}

export function partializeEventCache(state: EventCacheSnapshot): EventCacheSnapshot {
  const pinned = collectPinnedIds(state);
  const persistIds: string[] = [];
  const seen = new Set<string>();

  const push = (id: string) => {
    if (!id || seen.has(id) || !state.byId[id]) return;
    if (persistIds.length >= EVENT_CACHE_PERSIST_LIMIT) return;
    seen.add(id);
    persistIds.push(id);
  };

  for (const id of pinned) push(id);
  for (let index = state.order.length - 1; index >= 0; index -= 1) {
    push(state.order[index]);
  }

  const byId: Record<string, EventWithCreator> = {};
  for (const id of persistIds) {
    byId[id] = toPersistedEventCard(state.byId[id]);
  }

  return {
    byId,
    order: persistIds,
    pinnedBySurface: state.pinnedBySurface,
    openedId: state.openedId,
    epoch: 0,
  };
}

export function eventsFromCache(
  state: Pick<EventCacheSnapshot, 'byId'>,
  ids: string[],
): EventWithCreator[] {
  const events: EventWithCreator[] = [];
  for (const id of ids) {
    const event = state.byId[id];
    if (event) events.push(event);
  }
  return events;
}
