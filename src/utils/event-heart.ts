import { SocialService } from '@/services/social.service';
import type { EventWithCreator } from '@/types/database';

export function isEventHearted(isLiked: boolean, isFavorite: boolean): boolean {
  return isLiked || isFavorite;
}

export async function toggleEventHeart(
  userId: string,
  event: EventWithCreator,
  state: { isLiked: boolean; isFavorite: boolean }
): Promise<{ isLiked: boolean; isFavorite: boolean }> {
  const hearted = isEventHearted(state.isLiked, state.isFavorite);
  let isLiked = state.isLiked;
  let isFavorite = state.isFavorite;

  if (hearted) {
    if (isLiked) {
      isLiked = await SocialService.like(userId, event.id);
    }
    if (isFavorite) {
      isFavorite = await SocialService.toggleFavorite(userId, event.id);
    }
  } else {
    if (!isLiked) {
      isLiked = await SocialService.like(userId, event.id);
    }
    if (!isFavorite) {
      isFavorite = await SocialService.toggleFavorite(userId, event.id);
    }
  }

  return { isLiked, isFavorite };
}

async function ensureToggleOn(toggle: () => Promise<boolean>): Promise<boolean> {
  let active = await toggle();

  // The RPC is a toggle. If local state was stale and the first call removed an
  // existing server-side value, a second call restores the intended final state.
  if (!active) active = await toggle();

  return active;
}

export async function ensureEventHearted(
  userId: string,
  event: EventWithCreator,
  state: { isLiked: boolean; isFavorite: boolean }
): Promise<{ isLiked: boolean; isFavorite: boolean }> {
  let isLiked = state.isLiked;
  let isFavorite = state.isFavorite;

  if (!isLiked) {
    isLiked = await ensureToggleOn(() => SocialService.like(userId, event.id));
  }
  if (!isFavorite) {
    isFavorite = await ensureToggleOn(() => SocialService.toggleFavorite(userId, event.id));
  }

  return { isLiked, isFavorite };
}

export async function removeEventHeart(
  userId: string,
  eventId: string,
): Promise<{ isLiked: false; isFavorite: false }> {
  await Promise.all([
    SocialService.unlike(userId, eventId),
    SocialService.removeFavorite(userId, eventId),
  ]);
  return { isLiked: false, isFavorite: false };
}

export function syncHeartStores(
  event: EventWithCreator,
  before: { isLiked: boolean; isFavorite: boolean },
  after: { isLiked: boolean; isFavorite: boolean },
  stores: {
    toggleLike: (eventId: string) => void;
    toggleFavorite: (event: EventWithCreator) => void;
  }
) {
  if (after.isLiked !== before.isLiked) {
    stores.toggleLike(event.id);
  }
  if (after.isFavorite !== before.isFavorite) {
    stores.toggleFavorite(event);
  }
}
