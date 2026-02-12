export interface CreatorEngagementStats {
  creator_id: string;
  total_events: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_followers: number;
  total_checkins: number;
  engagement_score: number;
  updated_at?: string;
}

export interface EventEngagementStatsEvent {
  id: string;
  title: string;
  starts_at: string | null;
  city: string | null;
  status: string | null;
  cover_url: string | null;
}

export interface EventEngagementStats {
  event_id: string;
  creator_id: string;
  views_count: number;
  likes_count: number;
  comments_count: number;
  favorites_count: number;
  checkins_count: number;
  shares_count: number;
  engagement_score: number;
  updated_at: string;
  event?: EventEngagementStatsEvent | null;
}

export interface CreatorFanProfile {
  display_name: string | null;
  avatar_url: string | null;
}

export interface CreatorFan {
  creator_id: string;
  fan_id: string;
  xp: number;
  level: number;
  super_fan: boolean;
  interactions_count: number;
  last_interaction_at: string | null;
  profile?: CreatorFanProfile | null;
}

export interface CreatorDashboardData {
  stats: CreatorEngagementStats;
  eventStats: EventEngagementStats[];
  fetchedAt: number;
}
