import type { EventWithCreator } from '@/types/database';
import { getTodayWindow, getWeekendWindow } from '../../utils/event-date-windows';
import { resolveDefaultEventEnd } from '../../utils/event-status';
import type { EventTimeScope } from '../../utils/event-time-scope';
import { MAP_VIEWPORT_LIMIT_MAX, SEARCH_FETCH_LIMIT } from '../../utils/search-helpers';
import type { ProposalDateWindow, ProposalPreferences } from './proposal.types';

export const PROPOSAL_POOL_SIZE = 20;
export const PROPOSAL_FETCH_LIMIT = SEARCH_FETCH_LIMIT;
export const PROPOSAL_CANDIDATE_FETCH_LIMIT = 80;
export const PROPOSAL_EXCLUDE_IDS_MAX = 500;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ProposalViewportRequest = {
  dateRange: { start: Date; end: Date } | null;
  timeScope: EventTimeScope;
  mergeUpcoming: boolean;
  limit: number;
};

export type ProposalCandidateRequest = {
  latitude: number;
  longitude: number;
  radiusKm: number;
  windowStart: string;
  windowEnd: string;
  categoryIds: string[];
  excludeIds: string[];
  limit: number;
};

export function uniqueProposalUuids(ids: Iterable<string> | null | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of ids ?? []) {
    const id = String(value || '').trim();
    if (!UUID_RE.test(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

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

/**
 * Same dates as the proposal card (`starts_at` / `ends_at`), not operating_hours.
 * A concert on 2 Sept must not match a request for 28 Sept just because a
 * scraped schedule line parsed to a later day.
 */
export function eventMatchesProposalWindow(
  event: Pick<EventWithCreator, 'starts_at' | 'ends_at'>,
  windowStart: Date,
  windowEnd: Date,
): boolean {
  if (!event?.starts_at) return false;
  const eventStart = new Date(event.starts_at);
  if (Number.isNaN(eventStart.getTime())) return false;
  const eventEnd = resolveDefaultEventEnd(event);
  if (!eventEnd || Number.isNaN(eventEnd.getTime())) return false;
  return eventStart <= windowEnd && eventEnd >= windowStart;
}

/**
 * Viewport fetch aligned with Home/Map: `current` is the 300 soonest live/upcoming
 * rows, so a custom weekend in three weeks never arrives unless we switch scope
 * (and raise the cap for wider windows).
 */
export function resolveProposalViewportRequest(
  preferences: Pick<ProposalPreferences, 'dateWindow' | 'customStartDate' | 'customEndDate'>,
  now: Date = new Date(),
): ProposalViewportRequest {
  const dateRange = getProposalDateRange(preferences.dateWindow, now, {
    startDate: preferences.customStartDate,
    endDate: preferences.customEndDate,
  });
  if (!dateRange) {
    return {
      dateRange: null,
      timeScope: 'current',
      mergeUpcoming: false,
      limit: PROPOSAL_FETCH_LIMIT,
    };
  }

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setHours(23, 59, 59, 999);

  const includesPastDays = dateRange.start < startOfToday;
  const entirelyPast = dateRange.end < startOfToday;
  const entirelyFuture = dateRange.start > endOfToday;
  const widerThanAWeek =
    dateRange.end.getTime() - dateRange.start.getTime() > 8 * 24 * 60 * 60 * 1000;
  const limit =
    entirelyFuture || entirelyPast || includesPastDays || widerThanAWeek || preferences.dateWindow === 'custom'
      ? MAP_VIEWPORT_LIMIT_MAX
      : PROPOSAL_FETCH_LIMIT;

  if (entirelyPast || includesPastDays) {
    return { dateRange, timeScope: 'all', mergeUpcoming: false, limit };
  }
  // Keep `current` + mergeUpcoming (not `upcoming` alone) so a festival that
  // already started still overlaps a future custom day.
  return { dateRange, timeScope: 'current', mergeUpcoming: true, limit };
}

export function resolveProposalCandidateRequest(params: {
  preferences: ProposalPreferences;
  excludedIds?: Iterable<string>;
  now?: Date;
}): ProposalCandidateRequest | null {
  const { preferences, excludedIds = [], now = new Date() } = params;
  if (!preferences.anchor) return null;
  const dateRange = getProposalDateRange(preferences.dateWindow, now, {
    startDate: preferences.customStartDate,
    endDate: preferences.customEndDate,
  });
  if (!dateRange) return null;

  return {
    latitude: preferences.anchor.latitude,
    longitude: preferences.anchor.longitude,
    radiusKm: preferences.radiusKm,
    windowStart: dateRange.start.toISOString(),
    windowEnd: dateRange.end.toISOString(),
    categoryIds: uniqueProposalUuids(preferences.categoryIds),
    excludeIds: uniqueProposalUuids(excludedIds).slice(0, PROPOSAL_EXCLUDE_IDS_MAX),
    limit: PROPOSAL_CANDIDATE_FETCH_LIMIT,
  };
}

export function shuffleProposalDeck<T>(items: T[], random: () => number = Math.random): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    const current = next[index];
    next[index] = next[swapWith];
    next[swapWith] = current;
  }
  return next;
}

export function selectProposalDeck(
  events: EventWithCreator[],
  random: () => number = Math.random,
): EventWithCreator[] {
  return shuffleProposalDeck(events, random).slice(0, PROPOSAL_POOL_SIZE);
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
      if (!eventMatchesProposalWindow(event, dateRange.start, dateRange.end)) return false;

      return (
        distanceBetweenKm(preferences.anchor!, {
          latitude: event.latitude,
          longitude: event.longitude,
        }) <= preferences.radiusKm
      );
    });
}
