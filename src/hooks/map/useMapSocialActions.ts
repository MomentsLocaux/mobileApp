import { useCallback } from 'react';
import type { EventWithCreator } from '@/types/database';
import { isEventHearted, syncHeartStores, toggleEventHeart } from '@/utils/event-heart';

type Params = {
  profileId?: string;
  likesSet: Set<string>;
  favoritesSet: Set<string>;
  toggleLike: (eventId: string) => void;
  toggleFavorite: (event: EventWithCreator) => void;
};

export function useMapSocialActions({
  profileId,
  likesSet,
  favoritesSet,
  toggleLike,
  toggleFavorite,
}: Params) {
  const handleToggleHeart = useCallback(
    async (event: EventWithCreator) => {
      if (!profileId) {
        console.warn('Cannot heart event without profile id');
        return;
      }

      const before = {
        isLiked: likesSet.has(event.id),
        isFavorite: favoritesSet.has(event.id),
      };

      try {
        const after = await toggleEventHeart(profileId, event, before);
        syncHeartStores(event, before, after, { toggleLike, toggleFavorite });
      } catch (error) {
        console.warn('toggle heart error', error);
      }
    },
    [favoritesSet, likesSet, profileId, toggleFavorite, toggleLike]
  );

  return { handleToggleHeart };
}

export function isHeartedInSets(eventId: string, likesSet: Set<string>, favoritesSet: Set<string>): boolean {
  return isEventHearted(likesSet.has(eventId), favoritesSet.has(eventId));
}
