import {
  DEFAULT_SORT_OPTION,
  DEFAULT_DISCOVERY_STATUS,
  DEFAULT_DISCOVERY_WHEN_PRESET,
  DISCOVERY_DEFAULT_RADIUS_KM,
  HOME_DEFAULT_SORT_OPTION,
  NO_ACTIVE_FILTER_LABEL,
  datePresetLabel,
  metaFilterLabel,
  sortOptionLabel,
  type DatePreset,
  type DiscoveryStatus,
  type MapMode,
} from '../constants/filters';
import type { EventFilters, SortOption, SortOrder } from '../types/filters';
import { resolveEventTimeScope, type EventTimeScope } from './event-time-scope';
import { buildFiltersFromSearch } from './search-filters';
import {
  isDefaultDiscoveryTemporal,
  resolveSearchTemporalChoice,
  SEARCH_TEMPORAL_CHOICES,
} from './search-temporal-choice';

export type DiscoverySurface = 'home' | 'map';

export interface DiscoveryCoords {
  latitude: number;
  longitude: number;
}

export interface DiscoveryWhenFilter {
  preset?: DatePreset;
  startDate?: string;
  endDate?: string;
  /** Include past events alongside current/upcoming results. */
  includePast?: boolean;
}

export interface DiscoveryPlaceFilter {
  /** Explicit center picked by the user; falls back to the device position when absent. */
  center?: DiscoveryCoords | null;
  label?: string;
  city?: string;
  postalCode?: string;
  radiusKm?: number;
}

export interface DiscoveryContentFilter {
  categories: string[];
  subcategories: string[];
  tags: string[];
  query?: string;
}

export interface DiscoverySortState {
  sortBy: SortOption;
  sortOrder?: SortOrder;
}

export interface DiscoveryCriteria {
  status: DiscoveryStatus;
  when: DiscoveryWhenFilter;
  place: DiscoveryPlaceFilter;
  content: DiscoveryContentFilter;
}

export interface DiscoveryPresentation {
  /** Sort is surface-scoped: the map list and the home feed keep independent choices. */
  sort: Record<DiscoverySurface, DiscoverySortState>;
  /** Presentation-only, excluded from the active filter count. */
  mapMode: MapMode;
}

export interface DiscoveryFilters extends DiscoveryCriteria, DiscoveryPresentation {}

export function createDefaultDiscoveryCriteria(): DiscoveryCriteria {
  return {
    status: DEFAULT_DISCOVERY_STATUS,
    when: { preset: DEFAULT_DISCOVERY_WHEN_PRESET, includePast: false },
    place: { center: null, radiusKm: DISCOVERY_DEFAULT_RADIUS_KM },
    content: { categories: [], subcategories: [], tags: [], query: '' },
  };
}

export function createDefaultDiscoveryFilters(): DiscoveryFilters {
  return {
    ...createDefaultDiscoveryCriteria(),
    sort: {
      home: { sortBy: HOME_DEFAULT_SORT_OPTION, sortOrder: 'asc' },
      map: { sortBy: DEFAULT_SORT_OPTION },
    },
    mapMode: 'standard',
  };
}

export function includesPast(filters: DiscoveryFilters): boolean {
  return filters.status === 'past' || Boolean(filters.when.includePast);
}

/** Server-side temporal scope for the current status. */
export function toTimeScope(
  filters: DiscoveryFilters,
  options?: { searchActive?: boolean }
): EventTimeScope {
  return resolveEventTimeScope({
    metaFilter: filters.status,
    searchActive: options?.searchActive ?? false,
    includePast: includesPast(filters),
  });
}

/** Center used for distance sorting and radius filtering. */
export function resolveSortCenter(
  filters: DiscoveryFilters,
  fallbackCoords?: DiscoveryCoords | null
): DiscoveryCoords | null {
  return filters.place.center ?? fallbackCoords ?? null;
}

/** Maps the discovery model onto the `EventFilters` shape consumed by queries. */
export function toEventFilters(
  filters: DiscoveryFilters,
  fallbackCoords?: DiscoveryCoords | null
): EventFilters {
  const center =
    filters.place.center ?? (filters.place.radiusKm !== undefined && fallbackCoords ? fallbackCoords : null);
  const query = filters.content.query?.trim();

  return buildFiltersFromSearch(
    {
      where: {
        history: [],
        location: center
          ? {
              latitude: center.latitude,
              longitude: center.longitude,
              label: filters.place.label ?? 'Autour de moi',
            }
          : undefined,
        radiusKm: filters.place.radiusKm,
      },
      when: {
        preset: filters.when.preset,
        startDate: filters.when.startDate,
        endDate: filters.when.endDate,
        includePast: includesPast(filters),
      },
      what: {
        categories: filters.content.categories,
        subcategories: filters.content.subcategories,
        // Retained in the data contract for backend compatibility, but no
        // longer exposed as a mobile discovery criterion.
        tags: [],
        query,
      },
    }
  );
}

function isPlaceFilterActive(place: DiscoveryPlaceFilter): boolean {
  const { center, label, radiusKm } = place;
  return (
    Boolean(center) ||
    Boolean(label?.trim()) ||
    (radiusKm !== undefined && radiusKm !== DISCOVERY_DEFAULT_RADIUS_KM)
  );
}

function hasPlaceFilter(filters: DiscoveryFilters): boolean {
  return isPlaceFilterActive(filters.place);
}

function defaultSortForSurface(surface: DiscoverySurface): SortOption {
  return surface === 'home' ? HOME_DEFAULT_SORT_OPTION : DEFAULT_SORT_OPTION;
}

function formatDiscoveryDate(value: string): string {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}`;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export function formatWhenDateRange(
  when: Pick<DiscoveryWhenFilter, 'startDate' | 'endDate'>,
  format: (value: string) => string = formatDiscoveryDate
): string | null {
  if (when.startDate && when.endDate && when.startDate !== when.endDate) {
    return `${format(when.startDate)}–${format(when.endDate)}`;
  }
  if (when.startDate || when.endDate) {
    return format(when.startDate || when.endDate || '');
  }
  return null;
}

function whenSummary(when: DiscoveryWhenFilter): string | null {
  if (when.preset) return datePresetLabel(when.preset);
  if (when.startDate && when.endDate) {
    return formatWhenDateRange(when);
  }
  if (when.startDate) return `Dès le ${formatDiscoveryDate(when.startDate)}`;
  if (when.endDate) return `Jusqu’au ${formatDiscoveryDate(when.endDate)}`;
  if (when.includePast) return 'Passés inclus';
  return null;
}

function placeSummary(place: DiscoveryPlaceFilter): string | null {
  if (!isPlaceFilterActive(place)) return null;

  const label = place.label?.trim() || (place.center ? 'Zone choisie' : null);
  const hasCustomRadius =
    place.radiusKm !== undefined && place.radiusKm !== DISCOVERY_DEFAULT_RADIUS_KM;

  if (label && place.radiusKm !== undefined) {
    return `${label} · ${Math.round(place.radiusKm)} km`;
  }
  if (label) return label;
  if (hasCustomRadius) return `${Math.round(place.radiusKm as number)} km`;
  return null;
}

/** Clears user criteria while preserving surface-specific presentation choices. */
export function resetDiscoveryCriteria(filters: DiscoveryFilters): DiscoveryFilters {
  return {
    ...filters,
    ...createDefaultDiscoveryCriteria(),
  };
}

/**
 * Number of user-visible active filters. `mapMode` is presentation only and is
 * never counted; sort is counted only when a surface is provided and differs
 * from the default.
 */
export function activeFilterCount(
  filters: DiscoveryFilters,
  options?: { surface?: DiscoverySurface }
): number {
  let count = 0;

  if (!isDefaultDiscoveryTemporal(filters.status, filters.when)) count += 1;
  if (hasPlaceFilter(filters)) count += 1;
  if (filters.content.categories.length > 0) count += 1;
  if (filters.content.subcategories.length > 0) count += 1;
  if (filters.content.query?.trim()) count += 1;

  const surface = options?.surface;
  if (surface && filters.sort[surface].sortBy !== defaultSortForSurface(surface)) count += 1;

  return count;
}

export interface SummarizeOptions {
  surface?: DiscoverySurface;
  /** Category / subcategory id → label, so the summary can name a single selection. */
  categoryLabels?: Record<string, string>;
  emptyLabel?: string;
  includeMapMode?: boolean;
}

/** Human-readable recap of the active filters, e.g. "En cours · Demain · 2 catégories". */
export function summarize(filters: DiscoveryFilters, options?: SummarizeOptions): string {
  const { surface, categoryLabels, emptyLabel = NO_ACTIVE_FILTER_LABEL, includeMapMode } =
    options ?? {};
  const parts: string[] = [];

  if (!isDefaultDiscoveryTemporal(filters.status, filters.when)) {
    const choice = resolveSearchTemporalChoice(filters.status, filters.when);
    const whenLabel = whenSummary(filters.when);
    if (choice === 'all' && whenLabel) {
      parts.push(whenLabel);
    } else if (choice) {
      parts.push(
        SEARCH_TEMPORAL_CHOICES.find((item) => item.key === choice)?.label ??
          metaFilterLabel(filters.status)
      );
    } else if (whenLabel) {
      parts.push(whenLabel);
    }
  }

  const placeLabel = placeSummary(filters.place);
  if (placeLabel) parts.push(placeLabel);

  const query = filters.content.query?.trim();
  if (query) parts.push(`« ${query} »`);

  const { categories, subcategories } = filters.content;
  if (categories.length === 1) {
    parts.push(categoryLabels?.[categories[0]] ?? '1 catégorie');
  } else if (categories.length > 1) {
    parts.push(`${categories.length} catégories`);
  }

  if (subcategories.length === 1) {
    parts.push(categoryLabels?.[subcategories[0]] ?? '1 sous-catégorie');
  } else if (subcategories.length > 1) {
    parts.push(`${subcategories.length} sous-catégories`);
  }

  if (includeMapMode && filters.mapMode !== 'standard') {
    parts.push('Satellite');
  }

  if (surface && filters.sort[surface].sortBy !== defaultSortForSurface(surface)) {
    parts.push(sortOptionLabel(filters.sort[surface].sortBy));
  }

  return parts.length > 0 ? parts.join(' · ') : emptyLabel;
}

/**
 * Contradictory combinations that can only ever return zero results, so callers
 * can warn instead of showing an unexplained empty state.
 */
export function explainEmptyCombination(filters: DiscoveryFilters): string | null {
  if (filters.status === 'past' && filters.when.preset) {
    return `« ${metaFilterLabel('past')} » ne peut pas être combiné avec « ${datePresetLabel(
      filters.when.preset
    )} ».`;
  }

  if (filters.status === 'live' && filters.when.preset === 'tomorrow') {
    return `« ${metaFilterLabel('live')} » ne peut pas être combiné avec « ${datePresetLabel(
      'tomorrow'
    )} ».`;
  }

  const { startDate, endDate } = filters.when;
  if (startDate && endDate) {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    if (!Number.isNaN(start) && !Number.isNaN(end) && start > end) {
      return 'La date de début est postérieure à la date de fin.';
    }
  }

  return null;
}

export function isCombinationEmpty(filters: DiscoveryFilters): boolean {
  return explainEmptyCombination(filters) !== null;
}
