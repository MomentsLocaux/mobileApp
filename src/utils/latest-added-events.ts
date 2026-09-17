import type { EventWithCreator } from '../types/database';

export const LATEST_ADDED_CAROUSEL_LIMIT = 10;

const createdAtMs = (event: EventWithCreator): number => {
  const ts = event.created_at ? Date.parse(event.created_at) : NaN;
  return Number.isFinite(ts) ? ts : 0;
};

/** Newest `created_at` first, already constrained to the current Home list set. */
export function takeLatestCreatedEvents(
  events: EventWithCreator[],
  limit = LATEST_ADDED_CAROUSEL_LIMIT,
): EventWithCreator[] {
  if (!events.length || limit <= 0) return [];
  return [...events]
    .sort((a, b) => {
      const delta = createdAtMs(b) - createdAtMs(a);
      if (delta !== 0) return delta;
      return (a.title || '').localeCompare(b.title || '', 'fr');
    })
    .slice(0, limit);
}
