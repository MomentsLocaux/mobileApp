import { create } from 'zustand';
import type { SortOption } from '../types/filters';
type Preset = 'today' | 'tomorrow' | 'weekend';

export interface SearchWhereState {
  location?: {
    latitude: number;
    longitude: number;
    label: string;
    city?: string;
    postalCode?: string;
  };
  radiusKm?: number;
  history: string[];
}

export interface SearchWhenState {
  preset?: Preset;
  startDate?: string;
  endDate?: string;
  includePast?: boolean;
}

export interface SearchWhoState {
  adults: number;
  children: number;
  babies: number;
}

export interface SearchWhatState {
  categories: string[];
  subcategories: string[];
  tags: string[];
}

export interface SearchState {
  where: SearchWhereState;
  when: SearchWhenState;
  who: SearchWhoState;
  what: SearchWhatState;
  sortBy?: SortOption;
  setWhere: (payload: Partial<SearchWhereState>) => void;
  setWhen: (payload: Partial<SearchWhenState>) => void;
  setWho: (updater: Partial<SearchWhoState>) => void;
  setWhat: (payload: Partial<SearchWhatState>) => void;
  setSortBy: (sortBy?: SortOption) => void;
  addHistory: (label: string) => void;
  resetSearch: () => void;
}

const initialState: Omit<SearchState, 'setWhere' | 'setWhen' | 'setWho' | 'setWhat' | 'setSortBy' | 'addHistory' | 'resetSearch'> = {
  where: { history: [] },
  when: { includePast: false },
  who: { adults: 1, children: 0, babies: 0 },
  what: { categories: [], subcategories: [], tags: [] },
  sortBy: 'triage',
};

export const useSearchStore = create<SearchState>((set, get) => ({
  ...initialState,

  setWhere: (payload) =>
    set((state) => ({
      where: { ...state.where, ...payload },
    })),

  setWhen: (payload) =>
    set((state) => ({
      when: { ...state.when, ...payload },
    })),

  setWho: (payload) =>
    set((state) => {
      const next = { ...state.who, ...payload };
      // Always ensure at least 1 adult
      if (next.children > 0 && next.adults === 0) {
        next.adults = 1;
      }
      if (next.babies > 0 && next.adults === 0) {
        next.adults = 1;
      }
      if (next.adults < 1) {
        next.adults = 1;
      }
      return { who: next };
    }),

  setWhat: (payload) =>
    set((state) => ({
      what: { ...state.what, ...payload },
    })),

  setSortBy: (sortBy) => set({ sortBy }),

  addHistory: (label: string) =>
    set((state) => {
      if (!label.trim()) return state;
      const existing = state.where.history.filter((item) => item !== label);
      const updated = [label, ...existing].slice(0, 5);
      return { where: { ...state.where, history: updated } };
    }),

  resetSearch: () => set({ ...initialState }),
}));
