import { useCallback } from 'react';
import { Alert } from 'react-native';
import type { EventWithCreator } from '@/types/database';
import { isEventHearted, syncHeartStores, toggleEventHeart } from '@/utils/event-heart';

export type MapHeartToggleResult = { beforeLiked: boolean; afterLiked: boolean };

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
    async (event: EventWithCreator): Promise<MapHeartToggleResult | null> => {
      if (!profileId) {
        Alert.alert('Connexion nécessaire', 'Connectez-vous pour aimer et enregistrer un événement.');
        return null;
      }

      const before = {
        isLiked: likesSet.has(event.id),
        isFavorite: favoritesSet.has(event.id),
      };

      try {
        const after = await toggleEventHeart(profileId, event, before);
        syncHeartStores(event, before, after, { toggleLike, toggleFavorite });
        return { beforeLiked: before.isLiked, afterLiked: after.isLiked };
      } catch (error) {
        console.warn('toggle heart error', error);
        Alert.alert('Erreur', 'Impossible d’enregistrer pour le moment.');
        return null;
      }
    },
    [favoritesSet, likesSet, profileId, toggleFavorite, toggleLike]
  );

  return { handleToggleHeart };
}

export function isHeartedInSets(eventId: string, likesSet: Set<string>, favoritesSet: Set<string>): boolean {
  return isEventHearted(likesSet.has(eventId), favoritesSet.has(eventId));
}
