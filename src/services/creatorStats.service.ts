import { supabase } from '@/lib/supabase/client';
import type {
  CreatorEngagementStats,
  EventEngagementStats,
  EventEngagementStatsEvent,
} from '@/types/creator.types';

const firstOrNull = <T>(value: unknown): T | null => {
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return (value as T) ?? null;
};

const emptyDashboard = (creatorId: string): CreatorEngagementStats => ({
  creator_id: creatorId,
  total_events: 0,
  total_views: 0,
  total_likes: 0,
  total_comments: 0,
  total_followers: 0,
  total_checkins: 0,
  engagement_score: 0,
});

const normalizeEventStats = (row: any): EventEngagementStats => ({
  event_id: row.event_id,
  creator_id: row.creator_id,
  views_count: Number(row.views_count ?? 0),
  likes_count: Number(row.likes_count ?? 0),
  comments_count: Number(row.comments_count ?? 0),
  favorites_count: Number(row.favorites_count ?? 0),
  checkins_count: Number(row.checkins_count ?? 0),
  shares_count: Number(row.shares_count ?? 0),
  engagement_score: Number(row.engagement_score ?? 0),
  updated_at: row.updated_at,
  event: firstOrNull<EventEngagementStatsEvent>(row.event),
});

export async function getCreatorDashboard(creatorId: string): Promise<CreatorEngagementStats> {
  const { data, error } = await supabase
    .from('creator_engagement_stats')
    .select('*')
    .eq('creator_id', creatorId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (!data) return emptyDashboard(creatorId);

  return {
    creator_id: data.creator_id,
    total_events: Number(data.total_events ?? 0),
    total_views: Number(data.total_views ?? 0),
    total_likes: Number(data.total_likes ?? 0),
    total_comments: Number(data.total_comments ?? 0),
    total_followers: Number(data.total_followers ?? 0),
    total_checkins: Number(data.total_checkins ?? 0),
    engagement_score: Number(data.engagement_score ?? 0),
    updated_at: data.updated_at,
  };
}

export async function getEventStats(creatorId: string): Promise<EventEngagementStats[]> {
  const { data, error } = await supabase
    .from('event_engagement_stats')
    .select(
      `
      event_id,
      creator_id,
      views_count,
      likes_count,
      comments_count,
      favorites_count,
      checkins_count,
      shares_count,
      engagement_score,
      updated_at,
      event:events!event_engagement_stats_event_id_fkey(id, title, starts_at, city, status, cover_url)
    `,
    )
    .eq('creator_id', creatorId)
    .order('engagement_score', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(normalizeEventStats);
}

export async function getTopEvents(creatorId: string, limit = 5): Promise<EventEngagementStats[]> {
  const all = await getEventStats(creatorId);
  return all.slice(0, Math.max(1, limit));
}
