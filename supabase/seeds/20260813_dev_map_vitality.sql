-- DEV seed: map vitality (engagement + live/imminent/boost).
-- Re-runnable. Backup in _dev_map_vitality_backup for event field mutations.
-- Apply only on DEV via MCP / manual SQL.
-- Requires: public._dev_map_vitality_backup (see 20260813_dev_map_vitality_backup.sql)

BEGIN;

-- Lifecycle trigger blocks schedule mutations used for live/imminent demos.
ALTER TABLE public.events DISABLE TRIGGER trg_enforce_event_lifecycle;

-- 1) Target pool: Metz current + a France sample for heatmap when zoomed out
CREATE TEMP TABLE tmp_vitality_targets ON COMMIT DROP AS
WITH metz AS (
  SELECT e.id
  FROM public.events e
  WHERE e.status = 'published'
    AND e.visibility = 'public'
    AND e.longitude BETWEEN 6.0 AND 6.35
    AND e.latitude BETWEEN 49.0 AND 49.25
    AND (
      e.starts_at > now()
      OR e.ends_at >= now()
      OR (e.ends_at IS NULL AND e.starts_at >= date_trunc('day', now()))
    )
  ORDER BY e.starts_at ASC NULLS LAST
  LIMIT 80
),
france AS (
  SELECT e.id
  FROM public.events e
  WHERE e.status = 'published'
    AND e.visibility = 'public'
    AND e.longitude BETWEEN -5.5 AND 9.5
    AND e.latitude BETWEEN 41.0 AND 51.5
    AND (
      e.starts_at > now()
      OR e.ends_at >= now()
      OR (e.ends_at IS NULL AND e.starts_at >= date_trunc('day', now()))
    )
    AND e.id NOT IN (SELECT id FROM metz)
  ORDER BY random()
  LIMIT 120
)
SELECT id, 'metz'::text AS cohort FROM metz
UNION ALL
SELECT id, 'france'::text AS cohort FROM france;

CREATE TEMP TABLE tmp_vitality_ranked ON COMMIT DROP AS
SELECT
  id,
  cohort,
  row_number() OVER (PARTITION BY cohort ORDER BY random())::int AS rn
FROM tmp_vitality_targets;

-- 2) Backup event fields before mutation (first seed only per event)
INSERT INTO public._dev_map_vitality_backup (
  event_id, starts_at, ends_at, boosted_until, comments_count, tags
)
SELECT e.id, e.starts_at, e.ends_at, e.boosted_until, e.comments_count, e.tags
FROM public.events e
JOIN tmp_vitality_ranked t ON t.id = e.id
ON CONFLICT (event_id) DO NOTHING;

-- 3) Live (~12): started 90min ago, ends in 5h
UPDATE public.events e
SET
  starts_at = now() - interval '90 minutes',
  ends_at = now() + interval '5 hours',
  comments_count = GREATEST(COALESCE(e.comments_count, 0), 8 + (t.rn % 20)),
  boosted_until = CASE WHEN t.rn <= 4 THEN now() + interval '18 hours' ELSE e.boosted_until END,
  tags = CASE
    WHEN e.tags IS NULL THEN ARRAY['map_vitality_seed']
    WHEN NOT ('map_vitality_seed' = ANY (e.tags)) THEN e.tags || ARRAY['map_vitality_seed']
    ELSE e.tags
  END
FROM tmp_vitality_ranked t
WHERE e.id = t.id
  AND t.cohort = 'metz'
  AND t.rn BETWEEN 1 AND 12;

-- 4) Imminent (~10): starts in 35–90 minutes
UPDATE public.events e
SET
  starts_at = now() + interval '35 minutes' + make_interval(mins => t.rn),
  ends_at = now() + interval '6 hours',
  comments_count = GREATEST(COALESCE(e.comments_count, 0), 4 + (t.rn % 12)),
  tags = CASE
    WHEN e.tags IS NULL THEN ARRAY['map_vitality_seed']
    WHEN NOT ('map_vitality_seed' = ANY (e.tags)) THEN e.tags || ARRAY['map_vitality_seed']
    ELSE e.tags
  END
FROM tmp_vitality_ranked t
WHERE e.id = t.id
  AND t.cohort = 'metz'
  AND t.rn BETWEEN 13 AND 22;

-- 5) Boost + comments on hot Metz / France events (no schedule change)
UPDATE public.events e
SET
  boosted_until = now() + interval '24 hours',
  comments_count = GREATEST(COALESCE(e.comments_count, 0), 15 + (t.rn % 25)),
  tags = CASE
    WHEN e.tags IS NULL THEN ARRAY['map_vitality_seed']
    WHEN NOT ('map_vitality_seed' = ANY (e.tags)) THEN e.tags || ARRAY['map_vitality_seed']
    ELSE e.tags
  END
FROM tmp_vitality_ranked t
WHERE e.id = t.id
  AND (
    (t.cohort = 'metz' AND t.rn BETWEEN 23 AND 35)
    OR (t.cohort = 'france' AND t.rn BETWEEN 1 AND 25)
  );

-- 6) Engagement rows: interests / likes / checkins with tiered density
WITH profile_pool AS (
  SELECT id, row_number() OVER (ORDER BY random())::int AS rn
  FROM public.profiles
),
profile_count AS (
  SELECT COUNT(*)::int AS n FROM profile_pool
),
pairs AS (
  SELECT
    t.id AS event_id,
    p.id AS user_id,
    p.rn AS profile_rn
  FROM tmp_vitality_ranked t
  CROSS JOIN profile_pool p
  CROSS JOIN profile_count pc
  WHERE p.rn <= CASE
      WHEN t.cohort = 'metz' AND t.rn <= 12 THEN LEAST(pc.n, 28 + (t.rn % 10))
      WHEN t.cohort = 'metz' AND t.rn <= 35 THEN LEAST(pc.n, 12 + (t.rn % 10))
      WHEN t.cohort = 'france' AND t.rn <= 25 THEN LEAST(pc.n, 18 + (t.rn % 12))
      ELSE LEAST(pc.n, 4 + (t.rn % 6))
    END
)
INSERT INTO public.event_interests (user_id, event_id, created_at)
SELECT user_id, event_id, now() - make_interval(hours => (profile_rn % 48))
FROM pairs
ON CONFLICT DO NOTHING;

WITH profile_pool AS (
  SELECT id, row_number() OVER (ORDER BY random())::int AS rn FROM public.profiles
),
profile_count AS (SELECT COUNT(*)::int AS n FROM profile_pool),
pairs AS (
  SELECT t.id AS event_id, p.id AS user_id, p.rn AS profile_rn
  FROM tmp_vitality_ranked t
  CROSS JOIN profile_pool p
  CROSS JOIN profile_count pc
  WHERE p.rn <= LEAST(pc.n, CASE
    WHEN t.cohort = 'metz' AND t.rn <= 20 THEN 16
    WHEN t.cohort = 'france' AND t.rn <= 20 THEN 12
    ELSE 5
  END)
)
INSERT INTO public.event_likes (user_id, event_id, created_at)
SELECT user_id, event_id, now() - make_interval(hours => (profile_rn % 72))
FROM pairs
ON CONFLICT DO NOTHING;

WITH profile_pool AS (
  SELECT id, row_number() OVER (ORDER BY random())::int AS rn FROM public.profiles
),
profile_count AS (SELECT COUNT(*)::int AS n FROM profile_pool),
pairs AS (
  SELECT t.id AS event_id, p.id AS user_id, e.latitude, e.longitude
  FROM tmp_vitality_ranked t
  JOIN public.events e ON e.id = t.id
  CROSS JOIN profile_pool p
  CROSS JOIN profile_count pc
  WHERE t.cohort = 'metz'
    AND t.rn <= 18
    AND p.rn <= LEAST(pc.n, 3 + (t.rn % 5))
)
INSERT INTO public.event_checkins (
  user_id, event_id, lat, lon, validated_radius, source, created_at
)
SELECT
  user_id,
  event_id,
  latitude + ((random() - 0.5) * 0.01),
  longitude + ((random() - 0.5) * 0.01),
  40 + (random() * 80)::int,
  'map_vitality_seed',
  now() - make_interval(hours => (random() * 12)::int)
FROM pairs
ON CONFLICT (event_id, user_id) DO NOTHING;

ALTER TABLE public.events ENABLE TRIGGER trg_enforce_event_lifecycle;

COMMIT;
