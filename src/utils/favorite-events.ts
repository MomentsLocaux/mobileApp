import type { EventWithCreator } from '../types/database';
import { isEventLive, isEventPast, isEventUpcoming } from './event-status';

export type FavoriteTimeFilter = 'active' | 'live' | 'upcoming' | 'past' | 'all';

export const DEFAULT_FAVORITE_TIME_FILTER: FavoriteTimeFilter = 'active';

export function matchesFavoriteTimeFilter(
  event: EventWithCreator,
  filter: FavoriteTimeFilter,
  now: Date = new Date(),
): boolean {
  if (filter === 'all') return true;
  if (filter === 'live') return isEventLive(event, now);
  if (filter === 'upcoming') return isEventUpcoming(event, now);
  if (filter === 'past') return isEventPast(event, now);
  return isEventLive(event, now) || isEventUpcoming(event, now);
}

export function filterFavoriteEvents(
  events: EventWithCreator[],
  filter: FavoriteTimeFilter = DEFAULT_FAVORITE_TIME_FILTER,
  now: Date = new Date(),
): EventWithCreator[] {
  return events.filter((event) => matchesFavoriteTimeFilter(event, filter, now));
}

