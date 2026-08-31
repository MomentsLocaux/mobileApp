import { supabase } from '@/lib/supabase/client';

export type EventCardStats = {
  viewsCount: number;
  friendsGoingCount: number;
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

const rememberStats = (
  eventId: string,
  stats: EventCardStats,
  currentUserId?: string | null
) => {
  const key = cacheKeyForEvent(eventId, currentUserId);
  if (statsCache.has(key)) statsCache.delete(key);
  statsCache.set(key, { stats: { ...stats }, storedAt: Date.now() });
  while (statsCache.size > EVENT_CARD_STATS_CACHE_MAX) {
    const oldestKey = statsCache.keys().next().value;
    if (!oldestKey) break;
    statsCache.delete(oldestKey);
  }
};

export const EventCardStatsService = {
  async getStatsForEvents(eventIds: string[], currentUserId?: string | null): Promise<Record<string, EventCardStats>> {
    const uniqueEventIds = Array.from(new Set((eventIds || []).filter(Boolean)));
    const result: Record<string, EventCardStats> = {};
    const missingEventIds: string[] = [];
    const now = Date.now();
    uniqueEventIds.forEach((id) => {
      const cached = statsCache.get(cacheKeyForEvent(id, currentUserId));
      if (cached && now - cached.storedAt <= EVENT_CARD_STATS_TTL_MS) {
        result[id] = { ...cached.stats };
      } else {
        result[id] = { viewsCount: 0, friendsGoingCount: 0 };
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
        fetched[id] = { viewsCount: 0, friendsGoingCount: 0 };
      });

      const { data: viewCountRows, error: viewCountRowsError } = await supabase
        .rpc('get_event_views_counts', { event_ids: missingEventIds });

      if (!viewCountRowsError && Array.isArray(viewCountRows)) {
        viewCountRows.forEach((row: any) => {
          const eventId = row?.event_id;
          if (!eventId || !fetched[eventId]) return;
          fetched[eventId].viewsCount = Number(row?.views_count || 0);
        });
      }

      let friendsError: unknown = null;
      if (currentUserId) {
        const friendsResponse = await supabase
          .rpc('get_event_friend_favorite_counts', { event_ids: missingEventIds });
        friendsError = friendsResponse.error;

        if (!friendsResponse.error && Array.isArray(friendsResponse.data)) {
          friendsResponse.data.forEach((row: any) => {
            const eventId = row?.event_id;
            if (!eventId || !fetched[eventId]) return;
            fetched[eventId].friendsGoingCount = Number(row?.friends_count || 0);
          });
        }
      }

      if (!viewCountRowsError && !friendsError) {
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
