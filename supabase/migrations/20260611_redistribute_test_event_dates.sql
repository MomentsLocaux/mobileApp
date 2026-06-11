-- DEV/QA: redistribute starts_at / ends_at on 100 published public events
-- Goal: realistic spread for map filters (à venir, en cours) and date presets (today, tomorrow, weekend).
-- Reversible: only touches selected rows; keeps coordinates and metadata intact.

BEGIN;

ALTER TABLE public.events DISABLE TRIGGER trg_enforce_event_lifecycle;

WITH paris AS (
  SELECT
    now() AS n,
    (now() AT TIME ZONE 'Europe/Paris') AS local_now,
    date_trunc('day', (now() AT TIME ZONE 'Europe/Paris')) AS local_day,
    EXTRACT(DOW FROM (now() AT TIME ZONE 'Europe/Paris'))::int AS dow
),
weekend AS (
  SELECT
    p.*,
    ((6 - p.dow + 7) % 7) AS days_to_saturday
  FROM paris p
),
ranked AS (
  SELECT
    e.id,
    row_number() OVER (ORDER BY md5(e.id::text)) AS rn
  FROM public.events e
  WHERE e.status = 'published'
    AND e.visibility = 'public'
  LIMIT 100
),
slots AS (
  SELECT
    r.id,
    r.rn,
    CASE
      WHEN r.rn BETWEEN 1 AND 10 THEN 'upcoming_today'
      WHEN r.rn BETWEEN 11 AND 20 THEN 'upcoming_tomorrow'
      WHEN r.rn BETWEEN 21 AND 30 THEN 'upcoming_weekend'
      WHEN r.rn BETWEEN 31 AND 40 THEN 'upcoming_soon'
      WHEN r.rn BETWEEN 41 AND 50 THEN 'upcoming_later'
      WHEN r.rn BETWEEN 51 AND 60 THEN 'live_today'
      WHEN r.rn BETWEEN 61 AND 70 THEN 'live_recent'
      WHEN r.rn BETWEEN 71 AND 80 THEN 'live_multiday'
      WHEN r.rn BETWEEN 81 AND 90 THEN 'live_now_short'
      ELSE 'live_long'
    END AS slot
  FROM ranked r
),
computed AS (
  SELECT
    s.id,
    s.rn,
    s.slot,
    CASE s.slot
      WHEN 'upcoming_today' THEN
        (w.local_day + make_interval(hours => (10 + (s.rn % 8))::int, mins => ((s.rn % 4) * 15)::int)) AT TIME ZONE 'Europe/Paris'
      WHEN 'upcoming_tomorrow' THEN
        (w.local_day + interval '1 day' + make_interval(hours => (9 + (s.rn % 10))::int, mins => ((s.rn % 3) * 20)::int)) AT TIME ZONE 'Europe/Paris'
      WHEN 'upcoming_weekend' THEN
        (w.local_day + make_interval(days => (w.days_to_saturday + (s.rn % 2))::int, hours => (10 + (s.rn % 8))::int)) AT TIME ZONE 'Europe/Paris'
      WHEN 'upcoming_soon' THEN
        (w.local_day + make_interval(days => (3 + (s.rn % 7))::int, hours => (11 + (s.rn % 6))::int)) AT TIME ZONE 'Europe/Paris'
      WHEN 'upcoming_later' THEN
        (w.local_day + make_interval(days => (12 + (s.rn % 18))::int, hours => (14 + (s.rn % 5))::int)) AT TIME ZONE 'Europe/Paris'
      WHEN 'live_today' THEN
        (w.local_day + make_interval(hours => (8 + (s.rn % 4))::int)) AT TIME ZONE 'Europe/Paris'
      WHEN 'live_recent' THEN
        w.n - make_interval(days => (1 + (s.rn % 2))::int, hours => (2 + (s.rn % 5))::int)
      WHEN 'live_multiday' THEN
        w.n - make_interval(days => (2 + (s.rn % 3))::int, hours => (1 + (s.rn % 4))::int)
      WHEN 'live_now_short' THEN
        w.n - make_interval(hours => 1, mins => (10 + (s.rn % 40))::int)
      ELSE
        w.n - make_interval(days => (4 + (s.rn % 5))::int, hours => (3 + (s.rn % 4))::int)
    END AS starts_at,
    CASE s.slot
      WHEN 'upcoming_today' THEN
        (w.local_day + make_interval(hours => (18 + (s.rn % 4))::int, mins => 30)) AT TIME ZONE 'Europe/Paris'
      WHEN 'upcoming_tomorrow' THEN
        (w.local_day + interval '1 day' + make_interval(hours => (20 + (s.rn % 3))::int)) AT TIME ZONE 'Europe/Paris'
      WHEN 'upcoming_weekend' THEN
        (w.local_day + make_interval(days => (w.days_to_saturday + (s.rn % 2))::int, hours => 22)) AT TIME ZONE 'Europe/Paris'
      WHEN 'upcoming_soon' THEN
        (w.local_day + make_interval(days => (3 + (s.rn % 7))::int, hours => (20 + (s.rn % 3))::int)) AT TIME ZONE 'Europe/Paris'
      WHEN 'upcoming_later' THEN
        (w.local_day + make_interval(days => (12 + (s.rn % 18))::int, hours => 21)) AT TIME ZONE 'Europe/Paris'
      WHEN 'live_today' THEN
        (w.local_day + make_interval(hours => 22, mins => 30)) AT TIME ZONE 'Europe/Paris'
      WHEN 'live_recent' THEN
        w.n + make_interval(days => (2 + (s.rn % 5))::int, hours => (3 + (s.rn % 4))::int)
      WHEN 'live_multiday' THEN
        w.n + make_interval(days => (10 + (s.rn % 10))::int, hours => 5)
      WHEN 'live_now_short' THEN
        w.n + make_interval(hours => (2 + (s.rn % 4))::int, mins => 30)
      ELSE
        w.n + make_interval(days => (14 + (s.rn % 12))::int, hours => 6)
    END AS ends_at
  FROM slots s
  CROSS JOIN weekend w
)
UPDATE public.events e
SET
  starts_at = c.starts_at,
  ends_at = c.ends_at,
  updated_at = now()
FROM computed c
WHERE e.id = c.id;

ALTER TABLE public.events ENABLE TRIGGER trg_enforce_event_lifecycle;

COMMIT;
