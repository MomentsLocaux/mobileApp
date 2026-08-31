import type { DatePreset, DiscoveryStatus } from '@/constants/filters';
import type { DiscoveryWhenFilter } from '@/utils/discovery-filters';

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
