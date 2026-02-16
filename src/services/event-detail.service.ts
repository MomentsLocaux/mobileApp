import { supabase } from '@/lib/supabase/client';

export type EventEngagementStats = {
  likes: number;
  favorites: number;
  interests: number;
  checkins: number;
  views: number;
};

export type EventAttendee = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

const EMPTY_STATS: EventEngagementStats = {
  likes: 0,
  favorites: 0,
  interests: 0,
  checkins: 0,
  views: 0,
};

const getDayBoundsIso = () => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
};

export const EventDetailService = {
  async getEventEngagementStats(eventId: string): Promise<EventEngagementStats> {
    if (!eventId) return EMPTY_STATS;

    const { data, error } = await supabase
      .from('event_engagement_stats')
      .select('likes_count, favorites_count, checkins_count, views_count')
      .eq('event_id', eventId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return EMPTY_STATS;

    return {
      likes: Number((data as any).likes_count || 0),
      favorites: Number((data as any).favorites_count || 0),
      interests: 0,
      checkins: Number((data as any).checkins_count || 0),
      views: Number((data as any).views_count || 0),
    };
  },

  async trackEventViewDaily(eventId: string, profileId?: string | null): Promise<void> {
    if (!eventId || !profileId) return;

    const today = new Date().toISOString().split('T')[0];

    // TODO(DB): add generated column `viewed_on date generated always as (viewed_at::date) stored`
    // and unique index on `(event_id, profile_id, viewed_on)` to make this upsert fully atomic.
    const { error: upsertError } = await (supabase.from('event_views') as any).upsert(
      {
        event_id: eventId,
        profile_id: profileId,
        viewed_on: today,
      },
      {
        onConflict: 'event_id,profile_id,viewed_on',
        ignoreDuplicates: true,
      },
    );

    if (!upsertError) return;

    const { startIso, endIso } = getDayBoundsIso();
    const { data: existing, error: existsError } = await supabase
      .from('event_views')
      .select('id')
      .eq('event_id', eventId)
      .eq('profile_id', profileId)
      .gte('viewed_at', startIso)
      .lt('viewed_at', endIso)
      .limit(1);
    if (existsError) throw existsError;
    if ((existing || []).length > 0) return;

    const { error: insertError } = await supabase.from('event_views').insert({
      event_id: eventId,
      profile_id: profileId,
    });
    if (insertError) throw insertError;
  },

  async getCheckinStatus(eventId: string, userId?: string | null): Promise<boolean> {
    if (!eventId || !userId) return false;

    const { data, error } = await supabase
      .from('event_checkins')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .limit(1);
    if (error) throw error;
    return Array.isArray(data) && data.length > 0;
  },

  async getCheckinXpReward(): Promise<number> {
    const { data, error } = await supabase
      .from('xp_rules')
      .select('amount')
      .eq('trigger_event', 'event_checkin')
      .eq('active', true)
      .order('amount', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return Number((data as any)?.amount || 0);
  },

  async getEventAttendees(eventId: string): Promise<{ attendees: EventAttendee[]; total: number }> {
    if (!eventId) return { attendees: [], total: 0 };

    const [{ data: rows, error }, { count, error: countError }] = await Promise.all([
      supabase
        .from('event_checkins')
        .select('user_id, created_at, profile:profiles!event_checkins_user_id_fkey(id, display_name, avatar_url)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('event_checkins').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    ]);

    if (error) throw error;
    if (countError) throw countError;

    const seen = new Set<string>();
    const attendees: EventAttendee[] = [];

    ((rows || []) as any[]).forEach((row) => {
      const userId = row?.user_id as string | undefined;
      const profile = row?.profile;
      if (!userId || seen.has(userId)) return;
      seen.add(userId);
      attendees.push({
        user_id: userId,
        display_name: profile?.display_name || null,
        avatar_url: profile?.avatar_url || null,
      });
    });

    return { attendees: attendees.slice(0, 3), total: Number(count || 0) };
  },

  async cleanupEventMedia(paths: string[]): Promise<void> {
    const cleaned = Array.from(new Set((paths || []).filter(Boolean)));
    if (!cleaned.length) return;
    const { error } = await supabase.storage.from('event-media').remove(cleaned);
    if (error) throw error;
  },
};
