import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import type { EventWithCreator } from '../types/database';

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

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
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
