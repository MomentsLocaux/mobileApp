import { supabase } from '@/lib/supabase/client';
import type { CommunityMember, LeaderboardEntry } from '@/types/community';
import type { EventWithCreator } from '@/types/database';

export const CommunityService = {
  async listMembers(options: {
    city?: string | null;
    sort?: 'followers' | 'events' | 'lumo';
    limit?: number;
    offset?: number;
  }): Promise<CommunityMember[]> {
    const { city, sort = 'followers', limit = 30, offset = 0 } = options;
    let query = supabase.from('community_profile_stats').select(`
      user_id,
      display_name,
      avatar_url,
      cover_url,
      city,
      bio,
      events_created_count,
      lumo_total,
      lumo_month,
      followers_count,
      following_count
    `);
    if (city) {
      query = query.eq('city', city);
    }
    if (sort === 'followers') {
      query = query.order('followers_count', { ascending: false });
    } else if (sort === 'events') {
      query = query.order('events_created_count', { ascending: false });
    } else if (sort === 'lumo') {
      query = query.order('lumo_total', { ascending: false });
    }
    query = query.limit(limit).range(offset, offset + limit - 1);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as CommunityMember[];
  },

  async getFollowingIds(currentUserId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('follows')
      .select('following')
      .eq('follower', currentUserId);
    if (error) throw error;
    return (data || []).map((row: any) => row.following as string);
  },

  async listLeaderboard(options: { period: 'monthly' | 'global'; city?: string | null; limit?: number }) {
    const { period, city = null, limit = 10 } = options;
    let query = supabase
      .from('community_leaderboard')
      .select('user_id, display_name, avatar_url, user_city, events_created_count, followers_count, lumo_total, lumo_month, score, rank, period, city')
      .eq('period', period)
      .order('rank', { ascending: true })
      .limit(limit);
    if (city) {
      query = query.eq('city', city);
    } else {
      query = query.is('city', null);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as LeaderboardEntry[];
  },

  async getMember(userId: string): Promise<CommunityMember | null> {
    const { data, error } = await supabase
      .from('community_profile_stats')
      .select('user_id, display_name, avatar_url, cover_url, city, bio, events_created_count, lumo_total, followers_count, following_count')
      .eq('user_id', userId)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return (data as CommunityMember) || null;
  },

  async getMyLeaderboardEntry(options: { period: 'monthly' | 'global'; city?: string | null; userId: string }) {
    const { period, city = null, userId } = options;
    let query = supabase
      .from('community_leaderboard')
      .select('*')
      .eq('period', period)
      .eq('user_id', userId)
      .limit(1);
    if (city) {
      query = query.eq('city', city);
    } else {
      query = query.is('city', null);
    }
    const { data, error } = await query.single();
    if (error && error.code !== 'PGRST116') throw error;
    return (data as LeaderboardEntry | null) ?? null;
  },

  async listCreatorEvents(options: {
    creatorId: string;
    dateFilter?: 'all' | 'upcoming' | 'past';
    visibility?: 'public' | 'prive' | 'all';
  }): Promise<EventWithCreator[]> {
    const { creatorId, dateFilter = 'all', visibility = 'all' } = options;
    let query = supabase
      .from('events')
      .select(
        `
        id, title, description, address, city, latitude, longitude, starts_at, ends_at, cover_url, category, visibility, is_free,
        event_media ( id, url, position, type, created_at ),
        profiles!events_creator_id_fkey ( id, display_name, avatar_url )
      `
      )
      .eq('creator_id', creatorId)
      .order('starts_at', { ascending: false });

    const nowIso = new Date().toISOString();
    if (dateFilter === 'upcoming') {
      query = query.gte('starts_at', nowIso);
    } else if (dateFilter === 'past') {
      query = query.lt('starts_at', nowIso);
    }
    if (visibility !== 'all') {
      query = query.eq('visibility', visibility);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((row: any) => ({
      ...row,
      media: row.event_media || [],
      creator: row.profiles ? { ...row.profiles } : { id: creatorId, display_name: '', avatar_url: null },
      likes_count: 0,
      comments_count: 0,
      checkins_count: 0,
      interests_count: 0,
    })) as EventWithCreator[];
  },

  async follow(userId: string) {
    const currentUser = (await supabase.auth.getUser()).data.user?.id;
    if (!currentUser) throw new Error('Not authenticated');
    const { error } = await supabase.from('follows').insert({ follower: currentUser, following: userId });
    if (error) throw error;
  },

  async unfollow(userId: string) {
    const currentUser = (await supabase.auth.getUser()).data.user?.id;
    if (!currentUser) throw new Error('Not authenticated');
    const { error } = await supabase.from('follows').delete().match({ follower: currentUser, following: userId });
    if (error) throw error;
  },

  async isFollowing(userId: string): Promise<boolean> {
    const currentUser = (await supabase.auth.getUser()).data.user?.id;
    if (!currentUser) return false;
    const { data, error } = await supabase
      .from('follows')
      .select('follower, following')
      .eq('follower', currentUser)
      .eq('following', userId)
      .limit(1);
    if (error) throw error;
    return !!data && data.length > 0;
  },
};
