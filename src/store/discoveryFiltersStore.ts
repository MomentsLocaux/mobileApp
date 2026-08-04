import { create } from 'zustand';
import type { DatePreset, DiscoveryStatus, MapMode } from '@/constants/filters';
import type { SortOption, SortOrder } from '@/types/filters';
import {
  createDefaultDiscoveryFilters,
  resetDiscoveryCriteria,
  type DiscoveryContentFilter,
  type DiscoveryFilters,
  type DiscoveryPlaceFilter,
  type DiscoverySurface,
  type DiscoveryWhenFilter,
} from '@/utils/discovery-filters';

/**
 * Target source of truth for discovery filters (home, map, search).
 * Legacy search state is migrated surface by surface.
 */
export interface DiscoveryFiltersState extends DiscoveryFilters {
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
  resetCriteria: () => void;
  reset: () => void;
}

export const useDiscoveryFiltersStore = create<DiscoveryFiltersState>((set) => ({
  ...createDefaultDiscoveryFilters(),

  setStatus: (status) =>
    set((state) => ({
      status,
      // Date presets describe now/future: drop them when browsing past events.
      when: status === 'past' ? { ...state.when, preset: undefined } : state.when,
    })),

  setWhenPreset: (preset) =>
    set((state) => ({ when: { ...state.when, preset: preset ?? undefined } })),

  setWhen: (when) => set((state) => ({ when: { ...state.when, ...when } })),

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

  resetCriteria: () => set((state) => resetDiscoveryCriteria(state)),

  reset: () => set(createDefaultDiscoveryFilters()),
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
