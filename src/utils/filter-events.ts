import type { EventWithCreator } from '../types/database';
import type { EventFilters, TimeFilter, PopularityFilter } from '../types/filters';

const POPULARITY_THRESHOLDS = {
  trending: 10,
  popular: 30,
  top: 50,
} as const;

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isLive(event: EventWithCreator, now: Date): boolean {
  const startsAt = new Date(event.starts_at);
  const endsAt = new Date(event.ends_at);

  if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) {
    return false;
  }

  return now >= startsAt && now <= endsAt;
}

function matchesTimeFilter(event: EventWithCreator, timeFilter: TimeFilter, now: Date): boolean {
  if (timeFilter === 'weekend') {
    const startsAt = new Date(event.starts_at);
    return !isNaN(startsAt.getTime()) && isWeekend(startsAt);
  }

  if (timeFilter === 'live') {
    return isLive(event, now);
  }

  return false;
}

function matchesPopularity(event: EventWithCreator, popularityFilter: PopularityFilter): boolean {
  const threshold = POPULARITY_THRESHOLDS[popularityFilter];
  return (event.interests_count || 0) >= threshold;
}

function isPastEvent(event: EventWithCreator, now: Date): boolean {
  const endsAt = new Date(event.ends_at);
  return !isNaN(endsAt.getTime()) && endsAt < now;
}

export function filterEvents(
  events: EventWithCreator[],
  filters: EventFilters,
  focusedIds: string[] | null = null
): EventWithCreator[] {
  const now = new Date();

  return events.filter((event) => {
    if (focusedIds && focusedIds.length > 0) {
      if (!focusedIds.includes(event.id)) {
        return false;
      }
    }

    if (!filters.includePast && isPastEvent(event, now)) {
      return false;
    }

    if (filters.category && event.category !== filters.category) {
      return false;
    }

    if (filters.time && !matchesTimeFilter(event, filters.time, now)) {
      return false;
    }

    if (filters.freeOnly && !event.is_free) {
      return false;
    }

    if (filters.paidOnly && event.is_free) {
      return false;
    }

    if (filters.visibility && event.visibility !== filters.visibility) {
      return false;
    }

    if (filters.popularity && !matchesPopularity(event, filters.popularity)) {
      return false;
    }

    if (filters.tag && (!event.tags || !event.tags.includes(filters.tag))) {
      return false;
    }

    return true;
  });
}

export function getActiveFilterCount(filters: EventFilters): number {
  let count = 0;

  if (filters.category) count++;
  if (filters.time) count++;
  if (filters.freeOnly) count++;
  if (filters.paidOnly) count++;
  if (filters.visibility) count++;
  if (filters.includePast) count++;
  if (filters.popularity) count++;
  if (filters.tag) count++;

  return count;
}
