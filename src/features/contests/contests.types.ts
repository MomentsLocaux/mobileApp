export type ContestStatus =
  | 'draft'
  | 'scheduled'
  | 'open'
  | 'voting_closed'
  | 'closed'
  | 'archived';

export type ContestEntryStatus = 'pending' | 'active' | 'refused' | 'hidden' | 'removed';

export type Contest = {
  id: string;
  title: string;
  description: string | null;
  theme: string | null;
  cover_url: string | null;
  rules_md: string | null;
  legal_version: string;
  start_at: string;
  end_at: string;
  voting_ends_at: string;
  geo_grid_meters: number;
  status: ContestStatus;
  reward: string | null;
  jury_announced_at: string | null;
};

export type ContestEntry = {
  id: string;
  contest_id: string;
  user_id: string;
  title: string | null;
  content: string | null;
  media_url: string | null;
  status: ContestEntryStatus;
  votes_count: number;
  zone_lat: number | null;
  zone_lng: number | null;
  refusal_reason: string | null;
  created_at: string;
};

export type ContestReward = {
  id: string;
  contest_id: string;
  entry_id: string | null;
  user_id: string | null;
  rank: number;
};

export type ContestVote = {
  contest_id: string;
  entry_id: string;
  user_id: string;
};
