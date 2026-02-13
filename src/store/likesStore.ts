import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { persistStorage } from './persistStorage';

interface LikesState {
  likedEventIds: string[];
  toggleLike: (eventId: string) => void;
  isLiked: (eventId: string) => boolean;
  clearLikes: () => void;
}

export const useLikesStore = create<LikesState>()(
  persist(
    (set, get) => ({
      likedEventIds: [],
      toggleLike: (eventId) =>
        set((state) => {
          const exists = state.likedEventIds.includes(eventId);
          return {
            likedEventIds: exists
              ? state.likedEventIds.filter((id) => id !== eventId)
              : [eventId, ...state.likedEventIds].slice(0, 500),
          };
        }),
      isLiked: (eventId) => get().likedEventIds.includes(eventId),
      clearLikes: () => set({ likedEventIds: [] }),
    }),
    {
      name: 'likes-store',
      storage: createJSONStorage(() => persistStorage),
      partialize: (state) => ({ likedEventIds: state.likedEventIds.slice(0, 500) }),
    }
  )
);

