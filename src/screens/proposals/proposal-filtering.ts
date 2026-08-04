import type { EventWithCreator } from '@/types/database';
import { eventOverlapsWindow, getTodayWindow, getWeekendWindow } from '../../utils/event-date-windows';
import type { ProposalDateWindow, ProposalPreferences } from './proposal.types';

export const PROPOSAL_POOL_SIZE = 20;

export function distanceBetweenKm(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
): number {
  const earthRadiusKm = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(destination.latitude - origin.latitude);
  const dLon = toRad(destination.longitude - origin.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(origin.latitude)) *
      Math.cos(toRad(destination.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getProposalDateRange(
  window: ProposalDateWindow,
  now: Date = new Date(),
): { start: Date; end: Date } {
  if (window === 'today') return getTodayWindow(now);
  if (window === 'weekend') return getWeekendWindow(now);

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + (window === '7_days' ? 6 : 29));
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

type FilterProposalPoolParams = {
  events: EventWithCreator[];
  preferences: ProposalPreferences;
  categoryValues: string[];
  excludedIds?: Iterable<string>;
  now?: Date;
};

export function filterProposalPool({
  events,
  preferences,
  categoryValues,
  excludedIds = [],
  now = new Date(),
}: FilterProposalPoolParams): EventWithCreator[] {
  if (!preferences.anchor) return [];

  const excluded = new Set(excludedIds);
  const selectedCategories = new Set(categoryValues);
  const dateRange = getProposalDateRange(preferences.dateWindow, now);

  return events
    .filter((event) => {
      if (!event?.id || excluded.has(event.id) || event.is_liked || event.is_favorited) return false;
      if (event.status !== 'published' || event.visibility !== 'public') return false;
      if (!Number.isFinite(event.latitude) || !Number.isFinite(event.longitude)) return false;
      if (selectedCategories.size > 0 && !selectedCategories.has(event.category || '')) return false;
      if (!eventOverlapsWindow(event, dateRange.start, dateRange.end, now)) return false;

      return (
        distanceBetweenKm(preferences.anchor!, {
          latitude: event.latitude,
          longitude: event.longitude,
        }) <= preferences.radiusKm
      );
    })
    .sort((left, right) => {
      const distanceLeft = distanceBetweenKm(preferences.anchor!, {
        latitude: left.latitude,
        longitude: left.longitude,
      });
      const distanceRight = distanceBetweenKm(preferences.anchor!, {
        latitude: right.latitude,
        longitude: right.longitude,
      });
      if (distanceLeft !== distanceRight) return distanceLeft - distanceRight;
      return new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime();
    })
    .slice(0, PROPOSAL_POOL_SIZE);
}
