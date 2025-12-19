import type { EventWithCreator } from '../types/database';
import type { EventFilters, TimeFilter, PopularityFilter } from '../types/filters';

const POPULARITY_THRESHOLDS = {
  trending: 10,
  popular: 30,
  top: 50,
} as const;

function getUpcomingWeekendWindow(now: Date): { start: Date; end: Date } {
  const start = new Date(now);
  const day = now.getDay();
  const daysUntilSaturday = (6 - day + 7) % 7; // 6 = Saturday
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + daysUntilSaturday);

  const end = new Date(start);
  end.setDate(start.getDate() + 2); // Saturday to end of Sunday
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function isLive(event: EventWithCreator, now: Date): boolean {
  const startsAt = new Date(event.starts_at);
  const endsAt = new Date(event.ends_at);

  if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) {
    return false;
  }

  return now >= startsAt && now <= endsAt;
}

function matchesTimeFilter(
  event: EventWithCreator,
  timeFilter: TimeFilter,
  now: Date
): boolean {
  if (timeFilter === 'weekend') {
    const startsAt = new Date(event.starts_at);
    if (isNaN(startsAt.getTime())) return false;
    const { start, end } = getUpcomingWeekendWindow(now);
    return startsAt >= start && startsAt <= end;
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

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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

    if (
      filters.radiusKm &&
      filters.centerLat !== undefined &&
      filters.centerLon !== undefined &&
      event.latitude !== undefined &&
      event.longitude !== undefined
    ) {
      const dist = distanceKm(filters.centerLat, filters.centerLon, event.latitude, event.longitude);
      if (dist > filters.radiusKm) return false;
    }

    return true;
  });
}

export function getActiveFilterCount(filters: EventFilters): number {
  let count = 0;

  if (filters.category) count++;
  if (filters.time) count++;
  if (filters.radiusKm) count++;
  if (filters.freeOnly) count++;
  if (filters.paidOnly) count++;
  if (filters.visibility) count++;
  if (filters.includePast) count++;
  if (filters.popularity) count++;
  if (filters.tag) count++;

  return count;
}
