import { create } from 'zustand';
import type { DatePreset, DiscoveryStatus, MapMode } from '../constants/filters';
import type { SortOption, SortOrder } from '../types/filters';
import {
  createDefaultDiscoveryCriteria,
  createDefaultDiscoveryFilters,
  resetDiscoveryCriteria,
  type DiscoveryCriteria,
  type DiscoveryContentFilter,
  type DiscoveryFilters,
  type DiscoveryPlaceFilter,
  type DiscoverySortState,
  type DiscoverySurface,
  type DiscoveryWhenFilter,
} from '../utils/discovery-filters';

/**
 * Target source of truth for discovery filters (home, map, search).
 * Legacy search state is migrated surface by surface.
 */
export interface DiscoveryFiltersState extends DiscoveryFilters {
  searchApplied: boolean;
  searchRevision: number;
  placeHistory: string[];
  setStatus: (status: DiscoveryStatus) => void;
  setWhenPreset: (preset?: DatePreset | null) => void;
  setWhen: (when: Partial<DiscoveryWhenFilter>) => void;
  clearWhen: () => void;
  setPlace: (place: Partial<DiscoveryPlaceFilter>) => void;
  setRadiusKm: (radiusKm?: number) => void;
  setContent: (content: Partial<DiscoveryContentFilter>) => void;
  setSort: (surface: DiscoverySurface, sortBy: SortOption, sortOrder?: SortOrder) => void;
  setSortOrder: (surface: DiscoverySurface, sortOrder?: SortOrder) => void;
  setMapMode: (mapMode: MapMode) => void;
  setSearchApplied: (applied: boolean) => void;
  commitSearch: () => void;
  applySearchCriteria: (
    criteria: Pick<DiscoveryCriteria, 'when' | 'place' | 'content'>,
    options?: {
      status?: DiscoveryStatus;
      surface?: DiscoverySurface;
      sort?: DiscoverySortState;
      applied?: boolean;
    }
  ) => DiscoveryFilters;
  addPlaceHistory: (label: string) => void;
  removePlaceHistory: (label: string) => void;
  clearSearchCriteria: () => void;
  resetCriteria: () => void;
  reset: () => void;
}

export const useDiscoveryFiltersStore = create<DiscoveryFiltersState>((set, get) => ({
  ...createDefaultDiscoveryFilters(),
  searchApplied: false,
  searchRevision: 0,
  placeHistory: [],

  setStatus: (status) =>
    set((state) => ({
      status,
      // Date presets describe now/future: drop them when browsing past events.
      when:
        status === 'past'
          ? { includePast: false }
          : status === 'all'
            ? state.when
            : { ...state.when, includePast: false },
    })),

  setWhenPreset: (preset) =>
    set((state) => ({
      status: preset && state.status === 'past' ? 'all' : state.status,
      when: {
        ...state.when,
        preset: preset ?? undefined,
        includePast: preset ? false : state.when.includePast,
      },
    })),

  setWhen: (when) =>
    set((state) => {
      const activatesDatedSearch = Boolean(when.preset || when.startDate || when.endDate);
      const includePast = when.includePast === true;
      return {
        status:
          (activatesDatedSearch || includePast) && state.status === 'past'
            ? 'all'
            : state.status,
        when: includePast
          ? { includePast: true }
          : {
              ...state.when,
              ...when,
              includePast: activatesDatedSearch ? false : when.includePast ?? state.when.includePast,
            },
      };
    }),

  clearWhen: () => set({ when: {} }),

  setPlace: (place) => set((state) => ({ place: { ...state.place, ...place } })),

  setRadiusKm: (radiusKm) => set((state) => ({ place: { ...state.place, radiusKm } })),

  setContent: (content) => set((state) => ({ content: { ...state.content, ...content } })),

  setSort: (surface, sortBy, sortOrder) =>
    set((state) => ({
      sort: { ...state.sort, [surface]: { sortBy, sortOrder } },
    })),

  setSortOrder: (surface, sortOrder) =>
    set((state) => ({
      sort: { ...state.sort, [surface]: { ...state.sort[surface], sortOrder } },
    })),

  setMapMode: (mapMode) => set({ mapMode }),

  setSearchApplied: (searchApplied) => set({ searchApplied }),

  commitSearch: () =>
    set((state) => ({
      searchApplied: true,
      searchRevision: state.searchRevision + 1,
    })),

  applySearchCriteria: (criteria, options) => {
    let committed: DiscoveryFilters | null = null;
    set((state) => {
      const sort =
        options?.surface && options.sort
          ? { ...state.sort, [options.surface]: { ...options.sort } }
          : state.sort;
      committed = {
        status: options?.status ?? state.status,
        when: { ...criteria.when },
        place: { ...criteria.place },
        content: {
          ...criteria.content,
          categories: [...criteria.content.categories],
          subcategories: [...criteria.content.subcategories],
          // Legacy tags are intentionally excluded from mobile discovery.
          tags: [],
        },
        sort,
        mapMode: state.mapMode,
      };
      return {
        ...committed,
        searchApplied: options?.applied ?? true,
        searchRevision: state.searchRevision + 1,
      };
    });
    return committed ?? selectDiscoveryFilters(get());
  },

  addPlaceHistory: (label) =>
    set((state) => {
      const trimmed = label.trim();
      if (!trimmed) return state;
      const withoutDuplicate = state.placeHistory.filter((item) => item !== trimmed);
      return { placeHistory: [trimmed, ...withoutDuplicate].slice(0, 5) };
    }),

  removePlaceHistory: (label) =>
    set((state) => ({
      placeHistory: state.placeHistory.filter((item) => item !== label),
    })),

  clearSearchCriteria: () =>
    set((state) => {
      const defaults = createDefaultDiscoveryCriteria();
      return {
        when: defaults.when,
        place: defaults.place,
        content: defaults.content,
        searchApplied: false,
        searchRevision: state.searchRevision + 1,
      };
    }),

  resetCriteria: () =>
    set((state) => ({
      ...resetDiscoveryCriteria(state),
      searchApplied: false,
      searchRevision: state.searchRevision + 1,
    })),

  reset: () =>
    set((state) => ({
      ...createDefaultDiscoveryFilters(),
      searchApplied: false,
      searchRevision: state.searchRevision + 1,
      placeHistory: [],
    })),
}));

/** Plain snapshot of the filter values, without the action functions. */
export function selectDiscoveryFilters(state: DiscoveryFiltersState): DiscoveryFilters {
  return {
    status: state.status,
    when: state.when,
    place: state.place,
    content: state.content,
    sort: state.sort,
    mapMode: state.mapMode,
  };
}
