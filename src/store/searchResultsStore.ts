import { create } from 'zustand';
import type { EventWithCreator } from '../types/database';

interface SearchResultsState {
  events: EventWithCreator[];
  activeEventId?: string;
  setSearchResults: (events: EventWithCreator[]) => void;
  setActiveEvent: (id?: string) => void;
  clear: () => void;
}

export const useSearchResultsStore = create<SearchResultsState>((set) => ({
  events: [],
  activeEventId: undefined,
  setSearchResults: (events) => set({ events }),
  setActiveEvent: (id) => set({ activeEventId: id }),
  clear: () => set({ events: [], activeEventId: undefined }),
}));
