import { supabase } from '@/lib/supabase/client';

export type EventCardStats = {
  viewsCount: number;
  friendsGoingCount: number;
};

const chunk = <T,>(items: T[], size: number): T[][] => {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
};

export const EventCardStatsService = {
  async getStatsForEvents(eventIds: string[], currentUserId?: string | null): Promise<Record<string, EventCardStats>> {
    const uniqueEventIds = Array.from(new Set((eventIds || []).filter(Boolean)));
    const initial: Record<string, EventCardStats> = {};
    uniqueEventIds.forEach((id) => {
      initial[id] = { viewsCount: 0, friendsGoingCount: 0 };
    });
    if (!uniqueEventIds.length) return initial;

    const result: Record<string, EventCardStats> = { ...initial };

    const { data: engagementRows, error: engagementError } = await supabase
      .from('event_engagement_stats')
      .select('event_id, views_count')
      .in('event_id', uniqueEventIds);

    if (!engagementError && Array.isArray(engagementRows)) {
      engagementRows.forEach((row: any) => {
        const eventId = row?.event_id;
        if (!eventId || !result[eventId]) return;
        result[eventId].viewsCount = Number(row?.views_count || 0);
      });
    }

    if (!currentUserId) return result;

    const { data: followsRows, error: followsError } = await supabase
      .from('follows')
      .select('following')
      .eq('follower', currentUserId);
    if (followsError || !Array.isArray(followsRows) || followsRows.length === 0) return result;

    const followingIds = followsRows
      .map((row: any) => row?.following)
      .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);
    if (!followingIds.length) return result;

    const seen = new Set<string>();
    const followingChunks = chunk(followingIds, 200);

    for (const idsChunk of followingChunks) {
      const { data: favoritesRows, error: favoritesError } = await supabase
        .from('favorites')
        .select('event_id, profile_id')
        .in('event_id', uniqueEventIds)
        .in('profile_id', idsChunk);
      if (favoritesError || !Array.isArray(favoritesRows)) continue;

      favoritesRows.forEach((row: any) => {
        const eventId = row?.event_id;
        const profileId = row?.profile_id;
        if (!eventId || !profileId || !result[eventId]) return;
        const key = `${eventId}:${profileId}`;
        if (seen.has(key)) return;
        seen.add(key);
        result[eventId].friendsGoingCount += 1;
      });
    }

    return result;
  },
};
