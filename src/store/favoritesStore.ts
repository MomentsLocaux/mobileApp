import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { EventWithCreator } from '../types/database';
import { persistStorage } from './persistStorage';

interface FavoritesState {
  favorites: EventWithCreator[];
  toggleFavorite: (event: EventWithCreator) => void;
  replaceFavorites: (events: EventWithCreator[]) => void;
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
      replaceFavorites: (events) =>
        set({
          favorites: Array.isArray(events) ? events.slice(0, 200) : [],
        }),
      isFavorite: (eventId) => !!get().favorites.find((e) => e.id === eventId),
      clearFavorites: () => set({ favorites: [] }),
    }),
    {
      name: 'favorites-store',
      storage: createJSONStorage(() => persistStorage),
      partialize: (state) => ({ favorites: state.favorites.slice(0, 100) }),
    }
  )
);
