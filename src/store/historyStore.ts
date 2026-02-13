import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { EventWithCreator } from '../types/database';
import { persistStorage } from './persistStorage';

interface HistoryState {
  recentlyViewed: EventWithCreator[];
  addToHistory: (event: EventWithCreator) => void;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      recentlyViewed: [],
      addToHistory: (event) =>
        set((state) => {
          // dedupe
          const filtered = state.recentlyViewed.filter((e) => e.id !== event.id);
          const updated = [event, ...filtered].slice(0, 100);
          return { recentlyViewed: updated };
        }),
      clearHistory: () => set({ recentlyViewed: [] }),
    }),
    {
      name: 'history-store',
      storage: createJSONStorage(() => persistStorage),
    }
  )
);
