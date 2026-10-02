-- Duration bucket for public.events, matching the map "Par durée" filter.
-- Inclusive UTC calendar days between starts_at and ends_at:
--   1–3 exceptional, 4–14 short, 15+ long.
-- NULL when a bound is missing or ends_at <= starts_at (client "unknown").
-- Stored timestamptz values are returned by PostgREST in UTC, and the app
-- classifies the YYYY-MM-DD prefix of that ISO string. UTC days match that.
-- Recurrence does not change the bucket: only the publication span counts.
--
-- ADD COLUMN ... STORED rewrites public.events and backfills every row.
-- Apply off-peak.

CREATE OR REPLACE FUNCTION public.classify_event_duration(
  starts_at timestamptz,
  ends_at timestamptz
)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN starts_at IS NULL OR ends_at IS NULL OR ends_at <= starts_at THEN NULL
    ELSE (
      SELECT CASE
        WHEN days <= 3 THEN 'exceptional'
        WHEN days <= 14 THEN 'short'
        ELSE 'long'
      END
      FROM (
        SELECT (
          (ends_at AT TIME ZONE 'UTC')::date
          - (starts_at AT TIME ZONE 'UTC')::date
        ) + 1 AS days
      ) span
    )
  END;
$$;

COMMENT ON FUNCTION public.classify_event_duration(timestamptz, timestamptz) IS
  'Inclusive UTC calendar-day span of an event: exceptional (1–3), short (4–14), long (15+), or NULL. Marked IMMUTABLE because the zone is the constant UTC, so a stored generated column can call it.';

-- Writers (app users and the scraper service role) evaluate this on insert/update.
REVOKE ALL ON FUNCTION public.classify_event_duration(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classify_event_duration(timestamptz, timestamptz) TO authenticated, service_role;

ALTER TABLE public.events
  ADD COLUMN duration_bucket text
  GENERATED ALWAYS AS (public.classify_event_duration(starts_at, ends_at)) STORED
  CONSTRAINT events_duration_bucket_check
    CHECK (
      duration_bucket IS NULL
      OR duration_bucket IN ('exceptional', 'short', 'long')
    );

COMMENT ON COLUMN public.events.duration_bucket IS
  'Generated from starts_at/ends_at. exceptional = 1–3 UTC days, short = 4–14, long = 15+. NULL when bounds are missing or inverted.';

CREATE INDEX events_duration_bucket_idx
  ON public.events (duration_bucket)
  WHERE duration_bucket IS NOT NULL;
