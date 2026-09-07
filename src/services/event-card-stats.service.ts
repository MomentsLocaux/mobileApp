import { supabase } from '@/lib/supabase/client';
import { likesCountAfterHeartToggle } from '@/utils/likes-count';

export type EventCardLikerPreview = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  is_followed: boolean;
};

export type EventCardStats = {
  viewsCount: number;
  friendsGoingCount: number;
  likesCount: number;
  likers: EventCardLikerPreview[];
};

export const EVENT_CARD_LIKER_PREVIEW_LIMIT = 5;

type LikerPreviewRow = {
  event_id?: string;
  user_id?: string;
  display_name?: string;
  avatar_url?: string | null;
  is_followed?: boolean;
};

const EVENT_CARD_STATS_TTL_MS = 60 * 1000;
const EVENT_CARD_STATS_CACHE_MAX = 500;

type StatsCacheEntry = {
  stats: EventCardStats;
  storedAt: number;
};

const statsCache = new Map<string, StatsCacheEntry>();
const statsInflight = new Map<string, Promise<Record<string, EventCardStats>>>();

const cacheKeyForEvent = (eventId: string, currentUserId?: string | null) =>
  `${currentUserId || 'anonymous'}:${eventId}`;

const emptyStats = (): EventCardStats => ({
  viewsCount: 0,
  friendsGoingCount: 0,
  likesCount: 0,
  likers: [],
});

const rememberStats = (
  eventId: string,
  stats: EventCardStats,
  currentUserId?: string | null,
) => {
  const key = cacheKeyForEvent(eventId, currentUserId);
  if (statsCache.has(key)) statsCache.delete(key);
  statsCache.set(key, { stats: { ...stats, likers: [...stats.likers] }, storedAt: Date.now() });
  while (statsCache.size > EVENT_CARD_STATS_CACHE_MAX) {
    const oldestKey = statsCache.keys().next().value;
    if (!oldestKey) break;
    statsCache.delete(oldestKey);
  }
};

export function mergeLikerPreviews(
  likers: EventCardLikerPreview[],
  options?: { isLiked?: boolean; self?: EventCardLikerPreview | null },
): EventCardLikerPreview[] {
  const self = options?.self;
  const withoutSelf = self ? likers.filter((row) => row.id !== self.id) : likers;
  const followed = withoutSelf.filter((row) => row.is_followed);
  const rest = withoutSelf.filter((row) => !row.is_followed);
  const me = options?.isLiked && self ? [{ ...self, is_followed: false }] : [];
  const seen = new Set<string>();
  const merged: EventCardLikerPreview[] = [];
  for (const row of [...followed, ...me, ...rest]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
    if (merged.length >= EVENT_CARD_LIKER_PREVIEW_LIMIT) break;
  }
  return merged;
}

export function statsAfterLikeToggle(
  current: EventCardStats | undefined,
  beforeLiked: boolean,
  afterLiked: boolean,
  self: EventCardLikerPreview | null,
): EventCardStats {
  const base = current ?? emptyStats();
  return {
    ...base,
    likesCount: likesCountAfterHeartToggle(base.likesCount, beforeLiked, afterLiked),
    likers: mergeLikerPreviews(base.likers, { isLiked: afterLiked, self }),
  };
}

export const EventCardStatsService = {
  applyLikeToggle(
    eventId: string,
    beforeLiked: boolean,
    afterLiked: boolean,
    self: EventCardLikerPreview | null,
    currentUserId?: string | null,
    current?: EventCardStats,
  ): EventCardStats {
    const cached = current ?? statsCache.get(cacheKeyForEvent(eventId, currentUserId))?.stats;
    const next = statsAfterLikeToggle(cached, beforeLiked, afterLiked, self);
    rememberStats(eventId, next, currentUserId);
    return next;
  },

  async getStatsForEvents(eventIds: string[], currentUserId?: string | null): Promise<Record<string, EventCardStats>> {
    const uniqueEventIds = Array.from(new Set((eventIds || []).filter(Boolean)));
    const result: Record<string, EventCardStats> = {};
    const missingEventIds: string[] = [];
    const now = Date.now();
    uniqueEventIds.forEach((id) => {
      const cached = statsCache.get(cacheKeyForEvent(id, currentUserId));
      if (cached && now - cached.storedAt <= EVENT_CARD_STATS_TTL_MS) {
        result[id] = { ...cached.stats, likers: [...cached.stats.likers] };
      } else {
        result[id] = emptyStats();
        missingEventIds.push(id);
      }
    });
    if (!missingEventIds.length) return result;

    const requestKey = `${currentUserId || 'anonymous'}:${[...missingEventIds].sort().join(',')}`;
    const existing = statsInflight.get(requestKey);
    if (existing) {
      return { ...result, ...(await existing) };
    }

    const request = (async () => {
      const fetched: Record<string, EventCardStats> = {};
      missingEventIds.forEach((id) => {
        fetched[id] = emptyStats();
      });

      const { data: publicStats, error: publicStatsError } = await supabase.rpc('get_event_public_stats', {
        event_ids: missingEventIds,
      });
      if (!publicStatsError && Array.isArray(publicStats)) {
        publicStats.forEach((row: { event_id?: string; likes_count?: number; views_count?: number }) => {
          const eventId = row?.event_id;
          if (!eventId || !fetched[eventId]) return;
          fetched[eventId].likesCount = Number(row?.likes_count || 0);
          fetched[eventId].viewsCount = Number(row?.views_count || fetched[eventId].viewsCount || 0);
        });
      }

      const { data: viewCountRows, error: viewCountRowsError } = await supabase.rpc('get_event_views_counts', {
        event_ids: missingEventIds,
      });
      if (!viewCountRowsError && Array.isArray(viewCountRows)) {
        viewCountRows.forEach((row: { event_id?: string; views_count?: number }) => {
          const eventId = row?.event_id;
          if (!eventId || !fetched[eventId]) return;
          fetched[eventId].viewsCount = Number(row?.views_count || 0);
        });
      }

      let friendsError: unknown = null;
      if (currentUserId) {
        const friendsResponse = await supabase.rpc('get_event_friend_favorite_counts', {
          event_ids: missingEventIds,
        });
        friendsError = friendsResponse.error;
        if (!friendsResponse.error && Array.isArray(friendsResponse.data)) {
          friendsResponse.data.forEach((row: { event_id?: string; friends_count?: number }) => {
            const eventId = row?.event_id;
            if (!eventId || !fetched[eventId]) return;
            fetched[eventId].friendsGoingCount = Number(row?.friends_count || 0);
          });
        }

        const likersResponse = await supabase.rpc('get_event_liker_previews' as never, {
          p_event_ids: missingEventIds,
          p_limit_per_event: EVENT_CARD_LIKER_PREVIEW_LIMIT,
        } as never);
        const likersCode = String((likersResponse.error as { code?: string } | null)?.code || '');
        if (likersResponse.error && likersCode !== 'PGRST202' && likersCode !== '42883') {
          console.warn('get_event_liker_previews', likersResponse.error);
        }
        if (!likersResponse.error && Array.isArray(likersResponse.data)) {
          (likersResponse.data as LikerPreviewRow[]).forEach((row) => {
            const eventId = row?.event_id;
            const userId = row?.user_id;
            if (!eventId || !userId || !fetched[eventId]) return;
            fetched[eventId].likers.push({
              id: userId,
              display_name: row.display_name || 'Membre',
              avatar_url: row.avatar_url || null,
              is_followed: Boolean(row.is_followed),
            });
          });
        }
      }

      const viewsOk = !publicStatsError;
      if (viewsOk && !friendsError) {
        missingEventIds.forEach((id) => rememberStats(id, fetched[id], currentUserId));
      }
      return fetched;
    })();

    statsInflight.set(requestKey, request);
    try {
      const fetched = await request;
      return { ...result, ...fetched };
    } finally {
      if (statsInflight.get(requestKey) === request) {
        statsInflight.delete(requestKey);
      }
    }
  },
};
