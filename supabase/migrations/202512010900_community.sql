-- Community: follows RLS, stats view, leaderboard view

-- Add cover image to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS cover_url text;

-- Enforce constraints on follows
ALTER TABLE IF EXISTS follows
  ADD CONSTRAINT follows_no_self CHECK (follower <> following);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Policies: anyone authenticated can read follow relationships
DROP POLICY IF EXISTS "follows_select_auth" ON follows;
CREATE POLICY "follows_select_auth"
  ON follows
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert: only self as follower, prevent self-follow via constraint
DROP POLICY IF EXISTS "follows_insert_own" ON follows;
CREATE POLICY "follows_insert_own"
  ON follows
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower);

-- Delete (unfollow): only follower can delete
DROP POLICY IF EXISTS "follows_delete_own" ON follows;
CREATE POLICY "follows_delete_own"
  ON follows
  FOR DELETE
  TO authenticated
  USING (auth.uid() = follower);

-- Indexes to speed up follower/following lookups
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following);

--------------------------------------------------------------------------------
-- Community stats view
--------------------------------------------------------------------------------
DROP VIEW IF EXISTS community_leaderboard;
DROP VIEW IF EXISTS community_profile_stats;

CREATE OR REPLACE VIEW community_profile_stats AS
WITH lumo_agg AS (
  SELECT
    user_id,
    SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END) AS lumo_total,
    SUM(
      CASE
        WHEN type = 'credit' AND created_at >= date_trunc('month', now()) THEN amount
        ELSE 0
      END
    ) AS lumo_month
  FROM lumo_transactions
  GROUP BY user_id
),
event_counts AS (
  SELECT creator_id AS user_id, COUNT(*) AS events_created_count
  FROM events
  GROUP BY creator_id
),
follow_counts AS (
  SELECT
    following AS user_id,
    COUNT(*) AS followers_count
  FROM follows
  GROUP BY following
),
following_counts AS (
  SELECT
    follower AS user_id,
    COUNT(*) AS following_count
  FROM follows
  GROUP BY follower
)
SELECT
  p.id AS user_id,
  p.display_name,
  p.avatar_url,
  p.cover_url,
  p.city,
  p.bio,
  COALESCE(ec.events_created_count, 0) AS events_created_count,
  COALESCE(lu.lumo_total, 0) AS lumo_total,
  COALESCE(lu.lumo_month, 0) AS lumo_month,
  COALESCE(fc.followers_count, 0) AS followers_count,
  COALESCE(fgc.following_count, 0) AS following_count
FROM profiles p
LEFT JOIN event_counts ec ON ec.user_id = p.id
LEFT JOIN lumo_agg lu ON lu.user_id = p.id
LEFT JOIN follow_counts fc ON fc.user_id = p.id
LEFT JOIN following_counts fgc ON fgc.user_id = p.id;

--------------------------------------------------------------------------------
-- Community leaderboard view
--------------------------------------------------------------------------------
-- Score formula:
--   events_created_count * 40
--   + lumo_component (monthly for monthly/local, total for global) * 0.5
--   + followers_count * 10

CREATE OR REPLACE VIEW community_leaderboard AS
WITH stats AS (
  SELECT
    user_id,
    display_name,
    avatar_url,
    cover_url,
    city,
    events_created_count,
    followers_count,
    lumo_total,
    lumo_month
  FROM community_profile_stats
),
base AS (
  -- monthly (global)
  SELECT
    'monthly'::text AS period,
    NULL::text AS city_partition,
    s.user_id,
    s.display_name,
    s.avatar_url,
    s.cover_url,
    s.city AS user_city,
    s.events_created_count,
    s.followers_count,
    s.lumo_total,
    s.lumo_month,
    (events_created_count * 40)
      + (lumo_month * 0.5)
      + (followers_count * 10) AS score
  FROM stats s

  UNION ALL

  -- monthly (local by city)
  SELECT
    'monthly'::text AS period,
    s.city AS city_partition,
    s.user_id,
    s.display_name,
    s.avatar_url,
    s.cover_url,
    s.city AS user_city,
    s.events_created_count,
    s.followers_count,
    s.lumo_total,
    s.lumo_month,
    (events_created_count * 40)
      + (lumo_month * 0.5)
      + (followers_count * 10) AS score
  FROM stats s
  WHERE s.city IS NOT NULL AND s.city <> ''

  UNION ALL

  -- global (all-time)
  SELECT
    'global'::text AS period,
    NULL::text AS city_partition,
    s.user_id,
    s.display_name,
    s.avatar_url,
    s.cover_url,
    s.city AS user_city,
    s.events_created_count,
    s.followers_count,
    s.lumo_total,
    s.lumo_month,
    (events_created_count * 40)
      + (lumo_total * 0.5)
      + (followers_count * 10) AS score
  FROM stats s
),
ranked AS (
  SELECT
    period,
    city_partition AS city,
    user_id,
    display_name,
    avatar_url,
    cover_url,
    user_city,
    events_created_count,
    followers_count,
    lumo_total,
    lumo_month,
    score,
    RANK() OVER (
      PARTITION BY period, city_partition
      ORDER BY score DESC, events_created_count DESC, followers_count DESC, user_id
    ) AS rank
  FROM base
)
SELECT * FROM ranked;

-- Note: indexes cannot be created directly on views; create on base tables if needed.
