import { SocialService } from '@/services/social.service';
import { useAuthStore } from '@/state/auth';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useLikesStore } from '@/store/likesStore';
import type { EventWithCreator } from '@/types/database';

type HeartState = { isLiked: boolean; isFavorite: boolean };
const pending = new Map<string, Promise<HeartState>>();

export function isEventHearted(isLiked: boolean, isFavorite: boolean): boolean {
  return isLiked || isFavorite;
}

function isCurrentUser(userId: string) {
  return useAuthStore.getState().session?.user.id === userId;
}

function syncHeartStores(event: EventWithCreator, state: HeartState) {
  useLikesStore.getState().setLiked(event.id, state.isLiked);
  useFavoritesStore.getState().setFavorite(event, state.isFavorite);
}

function mutateHeart(userId: string, event: EventWithCreator, action: () => Promise<HeartState>): Promise<HeartState> {
  const key = `${userId}:${event.id}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const operation = Promise.resolve().then(async () => {
    if (!isCurrentUser(userId)) throw new Error('La session a changé.');
    try {
      const state = await action();
      if (!isCurrentUser(userId)) throw new Error('La session a changé.');
      syncHeartStores(event, state);
      return state;
    } catch (error) {
      // Both writes have settled before reading, including partial failures.
      // Keep the last known state if the network also prevents reconciliation.
      if (isCurrentUser(userId)) {
        try {
          const state = await SocialService.getHeartState(userId, event.id);
          if (isCurrentUser(userId)) syncHeartStores(event, state);
        } catch {
          // The original failure is surfaced by the screen; retry remains possible.
        }
      }
      throw error;
    }
  }).finally(() => { pending.delete(key); });
  pending.set(key, operation);
  return operation;
}

async function settleWrites(writes: Promise<unknown>[]) {
  const results = await Promise.allSettled(writes);
  const failure = results.find((result) => result.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
}

async function ensureToggleOn(toggle: () => Promise<boolean>): Promise<boolean> {
  let active = await toggle();
  // Existing RPCs toggle: a stale inactive client may remove an existing row.
  if (!active) active = await toggle();
  if (!active) throw new Error('Le cœur n’a pas pu être enregistré.');
  return active;
}

export function toggleEventHeart(userId: string, event: EventWithCreator, state: HeartState): Promise<HeartState> {
  return isEventHearted(state.isLiked, state.isFavorite)
    ? removeEventHeart(userId, event)
    : ensureEventHearted(userId, event, state);
}

export function ensureEventHearted(userId: string, event: EventWithCreator, state: HeartState): Promise<HeartState> {
  return mutateHeart(userId, event, async () => {
    await settleWrites([
      state.isLiked ? Promise.resolve() : ensureToggleOn(() => SocialService.like(userId, event.id)),
      state.isFavorite ? Promise.resolve() : ensureToggleOn(() => SocialService.toggleFavorite(userId, event.id)),
    ]);
    return { isLiked: true, isFavorite: true };
  });
}

export function removeEventHeart(userId: string, event: EventWithCreator): Promise<HeartState> {
  return mutateHeart(userId, event, async () => {
    // Unconditional, idempotent removal: never create a missing relation.
    await settleWrites([
      SocialService.unlike(userId, event.id),
      SocialService.removeFavorite(userId, event.id),
    ]);
    return { isLiked: false, isFavorite: false };
  });
}
