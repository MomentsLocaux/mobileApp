import { supabase } from '@/lib/supabase/client';

export type EventCardStats = {
  viewsCount: number;
  friendsGoingCount: number;
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

    const { data: viewCountRows, error: viewCountRowsError } = await supabase
      .rpc('get_event_views_counts', { event_ids: uniqueEventIds });

    if (!viewCountRowsError && Array.isArray(viewCountRows)) {
      viewCountRows.forEach((row: any) => {
        const eventId = row?.event_id;
        if (!eventId || !result[eventId]) return;
        result[eventId].viewsCount = Number(row?.views_count || 0);
      });
    }

    if (!currentUserId) return result;

    const { data: friendsRows, error: friendsError } = await supabase
      .rpc('get_event_friend_favorite_counts', { event_ids: uniqueEventIds });

    if (!friendsError && Array.isArray(friendsRows)) {
      friendsRows.forEach((row: any) => {
        const eventId = row?.event_id;
        if (!eventId || !result[eventId]) return;
        result[eventId].friendsGoingCount = Number(row?.friends_count || 0);
      });
    }

    return result;
  },
};
