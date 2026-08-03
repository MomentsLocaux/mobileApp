import type { SortOption, SortOrder } from '@/types/filters';
import type { EventMetaFilter } from '@/utils/filter-events';

export type DatePreset = 'today' | 'tomorrow' | 'weekend';

export type DiscoveryStatus = EventMetaFilter;

export type MapMode = 'standard' | 'satellite';

/** Default discovery browse radius (nearby carousel + search fallback). */
export const DISCOVERY_DEFAULT_RADIUS_KM = 10;

/** Explicit "À proximité" chip radius in SearchBar. */
export const DISCOVERY_PROXIMITY_RADIUS_KM = 40;

export const DISCOVERY_MIN_RADIUS_KM = 5;
export const DISCOVERY_MAX_RADIUS_KM = 100;
export const DISCOVERY_RADIUS_STEP_KM = 5;

export interface FilterOption<T extends string> {
  key: T;
  label: string;
}

export const META_FILTERS: readonly FilterOption<DiscoveryStatus>[] = [
  { key: 'all', label: 'Tous' },
  { key: 'live', label: 'En cours' },
  { key: 'upcoming', label: 'À venir' },
  { key: 'past', label: 'Passés' },
];

export const DATE_PRESETS: readonly FilterOption<DatePreset>[] = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'tomorrow', label: 'Demain' },
  { key: 'weekend', label: 'Ce week-end' },
];

export const MAP_MODES: readonly FilterOption<MapMode>[] = [
  { key: 'standard', label: 'Standard' },
  { key: 'satellite', label: 'Satellite' },
];

export const SORT_LABELS: Record<SortOption, string> = {
  triage: 'Pertinence',
  date: 'Date de début',
  endDate: 'Date de fin',
  created: 'Date de création',
  distance: 'Distance',
  popularity: 'Popularité',
};

export const SORT_ORDER_LABELS: Record<SortOrder, string> = {
  asc: 'Ascendant',
  desc: 'Descendant',
};

/** Sort options exposed in public discovery surfaces. `created` stays API-only. */
export const SORT_OPTIONS: readonly SortOption[] = [
  'triage',
  'date',
  'endDate',
  'distance',
  'popularity',
];

/** Every sort option, including the ones reserved for internal surfaces. */
export const ALL_SORT_OPTIONS: readonly SortOption[] = [...SORT_OPTIONS, 'created'];

/** Sorts for which an ascending/descending toggle is meaningful. */
export const ORDERABLE_SORT_OPTIONS: readonly SortOption[] = ['date', 'endDate', 'created'];

export const DEFAULT_SORT_OPTION: SortOption = 'triage';

export const DISTANCE_DISABLED_REASON = 'Activez la localisation pour trier par distance';

export const WHEN_DISABLED_WHEN_PAST_REASON =
  'Les dates rapides ne s’appliquent pas aux événements passés';

export const NO_ACTIVE_FILTER_LABEL = 'Aucun filtre actif';

export function metaFilterLabel(key: DiscoveryStatus): string {
  return META_FILTERS.find((item) => item.key === key)?.label ?? key;
}

export function datePresetLabel(key: DatePreset): string {
  return DATE_PRESETS.find((item) => item.key === key)?.label ?? key;
}

export function mapModeLabel(key: MapMode): string {
  return MAP_MODES.find((item) => item.key === key)?.label ?? key;
}

export function sortOptionLabel(key: SortOption): string {
  return SORT_LABELS[key] ?? key;
}

export function sortOrderLabel(order: SortOrder): string {
  return SORT_ORDER_LABELS[order] ?? order;
}

export function isOrderableSort(key: SortOption): boolean {
  return ORDERABLE_SORT_OPTIONS.includes(key);
}

/** Default direction applied the first time an orderable sort is picked. */
export function defaultSortOrderFor(key: SortOption): SortOrder {
  return key === 'created' ? 'desc' : 'asc';
}

export function formatRadiusLabel(radiusKm: number): string {
  return `${Math.round(radiusKm)} km`;
}
