-- Contract for public.classify_event_duration.
-- Same cases as mobileApp/src/utils/event-duration.test.ts, on timestamptz
-- instants (UTC calendar days, as PostgREST serializes them).
-- Run after 20261002122722_event_duration_bucket.sql. Read-only.

DO $$
DECLARE
  bucket text;
  generated "char";
BEGIN
  SELECT a.attgenerated
    INTO generated
  FROM pg_attribute a
  WHERE a.attrelid = 'public.events'::regclass
    AND a.attname = 'duration_bucket'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF generated IS DISTINCT FROM 's' THEN
    RAISE EXCEPTION 'duration_bucket must be a stored generated column, got %', generated;
  END IF;

  bucket := public.classify_event_duration(
    '2026-10-02T10:00:00+02:00',
    '2026-10-02T23:00:00+02:00'
  );
  IF bucket IS DISTINCT FROM 'exceptional' THEN
    RAISE EXCEPTION 'same-day: expected exceptional, got %', bucket;
  END IF;

  bucket := public.classify_event_duration(
    '2026-10-02T18:00:00+02:00',
    '2026-10-04T22:00:00+02:00'
  );
  IF bucket IS DISTINCT FROM 'exceptional' THEN
    RAISE EXCEPTION '3 days: expected exceptional, got %', bucket;
  END IF;

  bucket := public.classify_event_duration(
    '2026-10-01T10:00:00+02:00',
    '2026-10-04T10:00:00+02:00'
  );
  IF bucket IS DISTINCT FROM 'short' THEN
    RAISE EXCEPTION '4 days: expected short, got %', bucket;
  END IF;

  bucket := public.classify_event_duration(
    '2026-10-01T08:00:00+02:00',
    '2026-10-14T20:00:00+02:00'
  );
  IF bucket IS DISTINCT FROM 'short' THEN
    RAISE EXCEPTION '14 days: expected short, got %', bucket;
  END IF;

  bucket := public.classify_event_duration(
    '2026-10-01T08:00:00+02:00',
    '2026-10-15T08:00:00+02:00'
  );
  IF bucket IS DISTINCT FROM 'long' THEN
    RAISE EXCEPTION '15 days: expected long, got %', bucket;
  END IF;

  bucket := public.classify_event_duration(
    '2026-10-24T23:30:00+02:00',
    '2026-10-25T02:30:00+01:00'
  );
  IF bucket IS DISTINCT FROM 'exceptional' THEN
    RAISE EXCEPTION 'DST overnight: expected exceptional, got %', bucket;
  END IF;

  bucket := public.classify_event_duration(
    '2026-10-01T00:00:00+02:00',
    '2027-03-31T23:59:00+02:00'
  );
  IF bucket IS DISTINCT FROM 'long' THEN
    RAISE EXCEPTION 'publication span: expected long, got %', bucket;
  END IF;

  -- 00:30+02 is still the previous UTC date. The stored instant classifies
  -- on UTC days (Sep 30 through Oct 3 = 4), which is what the app sees.
  bucket := public.classify_event_duration(
    '2026-10-01T00:30:00+02:00',
    '2026-10-03T22:00:00+02:00'
  );
  IF bucket IS DISTINCT FROM 'short' THEN
    RAISE EXCEPTION 'UTC day boundary: expected short, got %', bucket;
  END IF;

  IF public.classify_event_duration('2026-10-02T10:00:00+02:00', NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'missing end must be NULL';
  END IF;

  IF public.classify_event_duration(NULL, '2026-10-02T10:00:00+02:00') IS NOT NULL THEN
    RAISE EXCEPTION 'missing start must be NULL';
  END IF;

  IF public.classify_event_duration(
    '2026-10-02T10:00:00+02:00',
    '2026-10-02T09:00:00+02:00'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'reversed bounds must be NULL';
  END IF;

  IF public.classify_event_duration(
    '2026-10-02T10:00:00+02:00',
    '2026-10-02T10:00:00+02:00'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'equal bounds must be NULL';
  END IF;
END $$;
