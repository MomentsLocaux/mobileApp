import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import type { EventWithCreator } from '@/types/database';
import { isEventHearted, toggleEventHeart } from '@/utils/event-heart';
import { useAuthStore } from '@/state/auth';
import { useLikesStore } from '@/store/likesStore';

export type MapHeartToggleResult = { beforeLiked: boolean; afterLiked: boolean };

type Params = {
  profileId?: string;
  likesSet: Set<string>;
  favoritesSet: Set<string>;
};

export function useMapSocialActions({
  profileId,
  likesSet,
  favoritesSet,
}: Params) {
  const pending = useRef(new Set<string>());
  const handleToggleHeart = useCallback(
    async (event: EventWithCreator): Promise<MapHeartToggleResult | null> => {
      if (!profileId) {
        Alert.alert('Connexion nécessaire', 'Connectez-vous pour aimer et enregistrer un événement.');
        return null;
      }
      if (pending.current.has(event.id)) return null;
      pending.current.add(event.id);

      const before = {
        isLiked: likesSet.has(event.id),
        isFavorite: favoritesSet.has(event.id),
      };

      try {
        const after = await toggleEventHeart(profileId, event, before);

        return { beforeLiked: before.isLiked, afterLiked: after.isLiked };
      } catch (error) {
        console.warn('toggle heart error', error);
        if (useAuthStore.getState().session?.user.id !== profileId) return null;
        Alert.alert('Erreur', 'Impossible d’enregistrer pour le moment.');
        // The shared helper has reconciled any partial write; update card counts too.
        return { beforeLiked: before.isLiked, afterLiked: useLikesStore.getState().isLiked(event.id) };
      } finally {
        pending.current.delete(event.id);
      }
    },
    [favoritesSet, likesSet, profileId]
  );

  return { handleToggleHeart };
}

export function isHeartedInSets(eventId: string, likesSet: Set<string>, favoritesSet: Set<string>): boolean {
  return isEventHearted(likesSet.has(eventId), favoritesSet.has(eventId));
}
