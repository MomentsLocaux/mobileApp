import type { EventWithCreator } from '../types/database';
import type { EventFilters, TimeFilter, PopularityFilter } from '../types/filters';
import { isEventLive, isEventPast, isEventUpcoming } from './event-status';
import { eventMatchesDatePreset } from './event-date-windows';

const POPULARITY_THRESHOLDS = {
  trending: 10,
  popular: 30,
  top: 50,
} as const;

function matchesTimeFilter(
  event: EventWithCreator,
  timeFilter: TimeFilter,
  now: Date
): boolean {
  if (timeFilter === 'weekend' || timeFilter === 'today' || timeFilter === 'tomorrow') {
    return eventMatchesDatePreset(event, timeFilter, now);
  }

  if (timeFilter === 'live') {
    return isEventLive(event, now);
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
  return isEventPast(event, now);
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

    if (!filters.includePast) {
      if (isPastEvent(event, now)) {
        return false;
      }

      // Par défaut (pas de filtre temps explicite), on exclut seulement les événements totalement passés
      if (!filters.startDate && !filters.endDate && !filters.time) {
        if (isEventPast(event, now)) {
          return false;
        }
      }
    }

    const eventCategory = (event as any).category;

    if (filters.category && eventCategory !== filters.category) {
      return false;
    }

    if (filters.categories && filters.categories.length > 0) {
      if (!filters.categories.includes(eventCategory || '')) {
        return false;
      }
    }

    if (filters.subcategory && event.subcategory !== filters.subcategory) {
      return false;
    }

    if (filters.subcategories && filters.subcategories.length > 0) {
      if (!filters.subcategories.includes(event.subcategory || '')) {
        return false;
      }
    }

    if (!filters.includePast) {
      if (filters.time && !matchesTimeFilter(event, filters.time, now)) {
        return false;
      }

      if (filters.startDate || filters.endDate) {
        const eventStart = new Date(event.starts_at);
        if (isNaN(eventStart.getTime())) return false;
        if (filters.startDate) {
          const start = new Date(filters.startDate);
          start.setHours(0, 0, 0, 0);
          if (eventStart < start) return false;
        }
        if (filters.endDate) {
          const end = new Date(filters.endDate);
          end.setHours(23, 59, 59, 999);
          if (eventStart > end) return false;
        }
      }
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

    if (filters.tags && filters.tags.length > 0) {
      if (!event.tags || !filters.tags.some((tag) => event.tags.includes(tag))) {
        return false;
      }
    }

    if (filters.name) {
      const query = filters.name.trim().toLowerCase();
      if (query) {
        const title = (event.title || '').toLowerCase();
        if (!title.includes(query)) return false;
      }
    }

    if (
      filters.radiusKm !== undefined &&
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
  if (filters.categories && filters.categories.length > 0) count++;
  if (filters.time || filters.startDate || filters.endDate) count++;
  if (filters.radiusKm) count++;
  if (filters.freeOnly) count++;
  if (filters.paidOnly) count++;
  if (filters.visibility) count++;
  if (filters.includePast) count++;
  if (filters.popularity) count++;
  if (filters.tag) count++;
  if (filters.tags && filters.tags.length > 0) count++;

  return count;
}

export type EventMetaFilter = 'all' | 'live' | 'upcoming' | 'past';

export function filterEventsByMetaStatus(
  events: EventWithCreator[],
  metaFilter: EventMetaFilter
): EventWithCreator[] {
  if (metaFilter === 'all') return events;
  const now = new Date();
  return events.filter((event) => {
    const startsAt = new Date(event.starts_at);
    const endsAt = new Date(event.ends_at);
    if (Number.isNaN(startsAt.getTime())) return false;
    if (metaFilter === 'live') {
      return isEventLive(event, now);
    }
    if (metaFilter === 'upcoming') {
      return isEventUpcoming(event, now);
    }
    if (metaFilter === 'past') {
      return isEventPast(event, now);
    }
    return true;
  });
}
