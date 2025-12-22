import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import type { EventWithCreator } from '../types/database';

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

interface FavoritesState {
  favorites: EventWithCreator[];
  toggleFavorite: (event: EventWithCreator) => void;
  isFavorite: (eventId: string) => boolean;
  clearFavorites: () => void;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],
      toggleFavorite: (event) =>
        set((state) => {
          const exists = state.favorites.find((e) => e.id === event.id);
          if (exists) {
            return { favorites: state.favorites.filter((e) => e.id !== event.id) };
          }
          return { favorites: [event, ...state.favorites] };
        }),
      isFavorite: (eventId) => !!get().favorites.find((e) => e.id === eventId),
      clearFavorites: () => set({ favorites: [] }),
    }),
    {
      name: 'favorites-store',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({ favorites: state.favorites.slice(0, 100) }),
    }
  )
);
