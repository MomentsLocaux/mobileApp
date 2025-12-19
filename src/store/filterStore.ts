import { create } from 'zustand';
import type { MapFilters } from '../types/filters';

interface FilterState {
  filters: MapFilters;
  focusedIds: string[] | null;
  setFilters: (filters: Partial<MapFilters>) => void;
  resetFilters: () => void;
  setFocusedIds: (ids: string[] | null) => void;
  getActiveFilterCount: () => number;
}

const initialFilters: MapFilters = {
  includePast: false,
  sortBy: 'date',
};

export const useFilterStore = create<FilterState>((set, get) => ({
  filters: initialFilters,
  focusedIds: null,

  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    })),

  resetFilters: () =>
    set({
      filters: initialFilters,
      focusedIds: null,
    }),

  setFocusedIds: (ids) => set({ focusedIds: ids }),

  getActiveFilterCount: () => {
    const { filters } = get();
    let count = 0;

    if (filters.category) count++;
    if (filters.categories && filters.categories.length > 0) count++;
    if (filters.time || filters.startDate || filters.endDate) count++;
    if (filters.freeOnly) count++;
    if (filters.paidOnly) count++;
    if (filters.visibility) count++;
    if (filters.includePast) count++;
    if (filters.popularity) count++;
    if (filters.tag) count++;
    if (filters.tags && filters.tags.length > 0) count++;

    return count;
  },
}));
