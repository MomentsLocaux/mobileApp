import { type DatePreset, type DiscoveryStatus } from '../constants/filters';
import { closeOpenDateRange, toDateOnlyString } from './date-range-selection';
import type { DiscoveryWhenFilter } from './discovery-filters';

export type SearchTemporalChoice =
  | 'all'
  | 'live'
  | 'today'
  | 'tomorrow'
  | 'weekend'
  | 'upcoming'
  | 'past';

export const SEARCH_TEMPORAL_CHOICES: readonly {
  key: SearchTemporalChoice;
  label: string;
}[] = [
  { key: 'all', label: 'Tous' },
  { key: 'live', label: 'En cours' },
  { key: 'today', label: "Aujourd'hui" },
  { key: 'tomorrow', label: 'Demain' },
  { key: 'weekend', label: 'Ce week-end' },
  { key: 'upcoming', label: 'À venir' },
  { key: 'past', label: 'Passés' },
];

export const DEFAULT_SEARCH_TEMPORAL_CHOICE: SearchTemporalChoice = 'today';

export function defaultDiscoveryTemporalFilters(): {
  status: DiscoveryStatus;
  when: DiscoveryWhenFilter;
} {
  return filtersForSearchTemporalChoice(DEFAULT_SEARCH_TEMPORAL_CHOICE);
}

export function isDefaultDiscoveryTemporal(
  status: DiscoveryStatus,
  when: DiscoveryWhenFilter
): boolean {
  if (when.includePast || when.startDate || when.endDate) return false;
  return resolveSearchTemporalChoice(status, when) === DEFAULT_SEARCH_TEMPORAL_CHOICE;
}

const DATE_PRESET_CHOICES: readonly DatePreset[] = ['today', 'tomorrow', 'weekend'];

export function resolveSearchTemporalChoice(
  status: DiscoveryStatus,
  when: DiscoveryWhenFilter
): SearchTemporalChoice | null {
  if (when.startDate || when.endDate) return null;
  if (when.preset && DATE_PRESET_CHOICES.includes(when.preset)) return when.preset;
  if (status === 'past') return 'past';
  if (status === 'upcoming') return 'upcoming';
  if (status === 'live') return 'live';
  return 'all';
}

export function filtersForSearchTemporalChoice(choice: SearchTemporalChoice): {
  status: DiscoveryStatus;
  when: DiscoveryWhenFilter;
} {
  if (choice === 'today' || choice === 'tomorrow' || choice === 'weekend') {
    return {
      status: 'all',
      when: { preset: choice, includePast: false },
    };
  }
  return {
    status: choice,
    when: {},
  };
}

export function filtersForCustomDateRange(
  range: { startDate?: string | null; endDate?: string | null },
  today: string = toDateOnlyString()
): { status: DiscoveryStatus; when: DiscoveryWhenFilter } {
  const closed = closeOpenDateRange({
    startDate: range.startDate || null,
    endDate: range.endDate || null,
  });
  const start = closed.startDate || undefined;
  const end = closed.endDate || undefined;
  if (!start && !end) {
    return defaultDiscoveryTemporalFilters();
  }
  const includesPastDays = Boolean(start && start < today);
  const entirelyPast = Boolean(end && end < today);
  const entirelyFuture = Boolean(start && start > today);
  return {
    status: entirelyPast ? 'past' : entirelyFuture ? 'upcoming' : 'all',
    when: {
      startDate: start,
      endDate: end,
      includePast: includesPastDays,
    },
  };
}
