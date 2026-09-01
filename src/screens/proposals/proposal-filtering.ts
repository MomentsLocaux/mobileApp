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

function parseLocalYmd(ymd: string, endOfDay: boolean): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  if (endOfDay) date.setHours(23, 59, 59, 999);
  else date.setHours(0, 0, 0, 0);
  return date;
}

export function formatProposalCustomDateLabel(
  startDate?: string | null,
  endDate?: string | null,
): string {
  if (!startDate) return 'Choisir une plage';
  const format = (value: string) => {
    const parsed = parseLocalYmd(value, false);
    if (!parsed) return value;
    return parsed.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };
  const end = endDate || startDate;
  if (end === startDate) return format(startDate);
  return `${format(startDate)} – ${format(end)}`;
}

export function getProposalDateRange(
  window: ProposalDateWindow,
  now: Date = new Date(),
  customRange?: { startDate?: string | null; endDate?: string | null },
): { start: Date; end: Date } | null {
  if (window === 'custom') {
    const startYmd = customRange?.startDate;
    if (!startYmd) return null;
    const endYmd = customRange?.endDate || startYmd;
    const start = parseLocalYmd(startYmd, false);
    const end = parseLocalYmd(endYmd, true);
    if (!start || !end) return null;
    if (start.getTime() <= end.getTime()) return { start, end };
    const swappedStart = parseLocalYmd(endYmd, false);
    const swappedEnd = parseLocalYmd(startYmd, true);
    if (!swappedStart || !swappedEnd) return null;
    return { start: swappedStart, end: swappedEnd };
  }

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
  const dateRange = getProposalDateRange(preferences.dateWindow, now, {
    startDate: preferences.customStartDate,
    endDate: preferences.customEndDate,
  });
  if (!dateRange) return [];

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
