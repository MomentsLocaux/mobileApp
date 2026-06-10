import { useCallback } from 'react';
import { SocialService } from '@/services/social.service';
import type { EventWithCreator } from '@/types/database';

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
  const handleToggleLike = useCallback(
    async (event: EventWithCreator) => {
      if (!profileId) {
        console.warn('Cannot like event without profile id');
        return;
      }

      try {
        const nowLiked = await SocialService.like(profileId, event.id);
        const wasLiked = likesSet.has(event.id);
        if (nowLiked !== wasLiked) {
          toggleLike(event.id);
        }
      } catch (error) {
        console.warn('toggle like error', error);
      }
    },
    [likesSet, profileId, toggleLike]
  );

  const handleToggleFavorite = useCallback(
    async (event: EventWithCreator) => {
      if (!profileId) {
        console.warn('Cannot favorite event without profile id');
        return;
      }

      try {
        const nowFavorited = await SocialService.toggleFavorite(profileId, event.id);
        const wasFavorited = favoritesSet.has(event.id);
        if (nowFavorited !== wasFavorited) {
          toggleFavorite(event);
        }
      } catch (error) {
        console.warn('toggle favorite error', error);
      }
    },
    [favoritesSet, profileId, toggleFavorite]
  );

  return { handleToggleLike, handleToggleFavorite };
}
