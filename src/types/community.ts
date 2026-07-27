export type CommunityMember = {
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
  cover_url?: string | null;
  city?: string | null;
  bio?: string | null;
  events_created_count: number;
  lumo_total: number;
  lumo_month?: number;
  followers_count: number;
  following_count?: number;
  is_following?: boolean;
  is_ambassadeur?: boolean;
  local_tier?: 'local' | 'habitue' | 'ambassadeur';
  is_community_highlighted?: boolean;
  community_highlighted_until?: string | null;
};

export type LeaderboardEntry = {
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
  city?: string | null;
  events_created_count: number;
  lumo_total: number;
  lumo_month?: number;
  followers_count: number;
  score: number;
  rank: number;
  period: 'monthly' | 'global';
};
