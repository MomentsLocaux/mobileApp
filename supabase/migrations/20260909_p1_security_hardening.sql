-- P1 security hardening (SCRUM-234 / SEC-001, SEC-002, SEC-004)
--
-- Console / moderator writes MUST keep working:
--   * is_moderator() bypasses burst rate limits (bulk QA, bugs, event edits)
--   * auth.uid() IS NULL (service_role) bypasses burst (website contact, Edge)
--   * authenticated SELECT on profiles + event_media stays USING (true)
--   * no CHECK on events / bug_reports (console + existing rows up to 31k)
--
-- Human validation required before apply on DEV/UAT.

-- ---------------------------------------------------------------------------
-- SEC-004 — backup table was created without RLS
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public._dev_map_vitality_backup ENABLE ROW LEVEL SECURITY;

-- Future objects created by the migration role are not auto-granted to anon.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon;

-- ---------------------------------------------------------------------------
-- SEC-004 — anon reads only published events' media; authenticated (incl. modo) unchanged
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS event_media_select_public ON public.event_media;

CREATE POLICY event_media_select_anon
  ON public.event_media
  FOR SELECT
  TO anon
  USING (public.can_view_event(event_id));

CREATE POLICY event_media_select_authenticated
  ON public.event_media
  FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- SEC-004 — anon sees active profiles only; console UsersList stays authenticated USING true
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_select_public ON public.profiles;

CREATE POLICY profiles_select_anon
  ON public.profiles
  FOR SELECT
  TO anon
  USING (status = 'active');

CREATE POLICY profiles_select_authenticated
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- SEC-002 — generous length CHECKs (verified against DEV maxima 2026-09-09)
-- comments max 93, bio 67, display_name 25. Skip bugs (max 31833) and events.
-- ---------------------------------------------------------------------------
ALTER TABLE public.event_comments
  DROP CONSTRAINT IF EXISTS event_comments_message_len;

ALTER TABLE public.event_comments
  ADD CONSTRAINT event_comments_message_len
  CHECK (char_length(message) BETWEEN 1 AND 4000);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_display_name_len;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_display_name_len
  CHECK (display_name IS NULL OR char_length(display_name) <= 120);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_bio_len;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_bio_len
  CHECK (bio IS NULL OR char_length(bio) <= 2000);

-- ---------------------------------------------------------------------------
-- SEC-001 — burst buckets (minute window). Moderators and service_role skip.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.write_rate_buckets (
  subject text NOT NULL,
  action text NOT NULL,
  window_start timestamptz NOT NULL,
  hit_count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (subject, action, window_start)
);

ALTER TABLE public.write_rate_buckets ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.write_rate_buckets IS
  'Sliding 1-minute write counters. service_role / SECURITY DEFINER only. Moderators never increment via the user trigger.';

CREATE OR REPLACE FUNCTION public.consume_write_rate_limit(
  p_subject text,
  p_action text,
  p_limit integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_window timestamptz := date_trunc('minute', timezone('utc', now()));
BEGIN
  IF p_subject IS NULL OR p_action IS NULL OR p_limit IS NULL OR p_limit < 1 THEN
    RETURN false;
  END IF;

  INSERT INTO public.write_rate_buckets (subject, action, window_start, hit_count)
  VALUES (p_subject, p_action, v_window, 1)
  ON CONFLICT (subject, action, window_start)
  DO UPDATE SET hit_count = public.write_rate_buckets.hit_count + 1
  RETURNING hit_count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_write_rate_limit(text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_write_rate_limit(text, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_user_write_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
BEGIN
  IF TG_TABLE_NAME = 'event_comments' THEN
    NEW.message := replace(NEW.message, chr(0), '');
  END IF;

  -- service_role / triggers without JWT: do not throttle (website + Edge + console never uses this path for bulk).
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Console admin writes in chain (events, bugs, QA, reports) use a moderator JWT.
  IF public.is_moderator() THEN
    RETURN NEW;
  END IF;

  v_ok := public.consume_write_rate_limit(
    'uid:' || auth.uid()::text,
    TG_ARGV[0],
    TG_ARGV[1]::integer
  );

  IF NOT v_ok THEN
    RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED'
      USING ERRCODE = 'P0001',
            HINT = 'Réessaie dans une minute.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_user_write_rate_limit() FROM PUBLIC, anon, authenticated;

-- User UGC only — never attach to events, moderation_actions, qa_*, admin_todos.
DROP TRIGGER IF EXISTS trg_event_comments_rate_limit ON public.event_comments;
CREATE TRIGGER trg_event_comments_rate_limit
  BEFORE INSERT ON public.event_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_write_rate_limit('comments', '20');

DROP TRIGGER IF EXISTS trg_reports_rate_limit ON public.reports;
CREATE TRIGGER trg_reports_rate_limit
  BEFORE INSERT ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_write_rate_limit('reports', '10');

DROP TRIGGER IF EXISTS trg_follows_rate_limit ON public.follows;
CREATE TRIGGER trg_follows_rate_limit
  BEFORE INSERT ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_write_rate_limit('follows', '30');

DROP TRIGGER IF EXISTS trg_favorites_rate_limit ON public.favorites;
CREATE TRIGGER trg_favorites_rate_limit
  BEFORE INSERT ON public.favorites
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_write_rate_limit('favorites', '40');

DROP TRIGGER IF EXISTS trg_event_likes_rate_limit ON public.event_likes;
CREATE TRIGGER trg_event_likes_rate_limit
  BEFORE INSERT ON public.event_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_write_rate_limit('likes', '40');

DROP TRIGGER IF EXISTS trg_bug_reports_rate_limit ON public.bug_reports;
CREATE TRIGGER trg_bug_reports_rate_limit
  BEFORE INSERT ON public.bug_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_write_rate_limit('bug_reports', '8');

DO $$
BEGIN
  IF to_regclass('public.comment_likes') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_comment_likes_rate_limit ON public.comment_likes;
    CREATE TRIGGER trg_comment_likes_rate_limit
      BEFORE INSERT ON public.comment_likes
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_user_write_rate_limit('comment_likes', '40');
  END IF;
END $$;
