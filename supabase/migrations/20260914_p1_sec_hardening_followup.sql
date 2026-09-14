-- P1 follow-up on DEV (SCRUM-234 / SEC-001, SEC-002, SEC-004)
-- Human validation required before UAT/prod.
--
-- SEC-001: burst on corrections + storage uploads; Edge fail-closed is in functions.
-- SEC-002: reports.reason CHECK; user bug_reports cap via trigger; null-byte strip.
-- SEC-004: event-media SELECT = owner / modo / published-linked objects.
--          contest-media: no anon SELECT (logic kept; mobile gated by feature flag).

-- ---------------------------------------------------------------------------
-- SEC-001 — corrections burst (daily quota already exists)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_event_correction_proposals_rate_limit
  ON public.event_correction_proposals;
CREATE TRIGGER trg_event_correction_proposals_rate_limit
  BEFORE INSERT ON public.event_correction_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_write_rate_limit('corrections', '8');

-- ---------------------------------------------------------------------------
-- SEC-001 — storage upload burst (user JWT only; service_role / modo skip)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_storage_upload_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.is_moderator() THEN
    RETURN NEW;
  END IF;

  v_ok := public.consume_write_rate_limit(
    'uid:' || auth.uid()::text,
    'uploads',
    20
  );
  IF NOT v_ok THEN
    RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED'
      USING ERRCODE = 'P0001',
            HINT = 'Réessaie dans une minute.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_storage_upload_rate_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_storage_objects_upload_rate_limit ON storage.objects;
CREATE TRIGGER trg_storage_objects_upload_rate_limit
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_storage_upload_rate_limit();

-- ---------------------------------------------------------------------------
-- SEC-002 — sanitize UGC on insert/update
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sanitize_ugc_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'event_comments' THEN
    NEW.message := replace(NEW.message, chr(0), '');
  ELSIF TG_TABLE_NAME = 'reports' THEN
    NEW.reason := replace(COALESCE(NEW.reason, ''), chr(0), '');
  ELSIF TG_TABLE_NAME = 'bug_reports' THEN
    NEW.description := replace(COALESCE(NEW.description, ''), chr(0), '');
    IF auth.uid() IS NOT NULL
       AND NOT public.is_moderator()
       AND char_length(NEW.description) > 4000 THEN
      RAISE EXCEPTION 'UGC_TOO_LONG'
        USING ERRCODE = 'P0001',
              HINT = 'Description limitée à 4000 caractères.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_comments_sanitize ON public.event_comments;
CREATE TRIGGER trg_event_comments_sanitize
  BEFORE INSERT OR UPDATE ON public.event_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_ugc_before_write();

DROP TRIGGER IF EXISTS trg_reports_sanitize ON public.reports;
CREATE TRIGGER trg_reports_sanitize
  BEFORE INSERT OR UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_ugc_before_write();

DROP TRIGGER IF EXISTS trg_bug_reports_sanitize ON public.bug_reports;
CREATE TRIGGER trg_bug_reports_sanitize
  BEFORE INSERT OR UPDATE ON public.bug_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_ugc_before_write();

ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_reason_len;
ALTER TABLE public.reports
  ADD CONSTRAINT reports_reason_len
  CHECK (reason IS NULL OR char_length(reason) BETWEEN 1 AND 2000);

-- Rate-limit trigger still stripped comments only; sanitizer trigger covers it now.
CREATE OR REPLACE FUNCTION public.enforce_user_write_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
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

-- ---------------------------------------------------------------------------
-- SEC-004 — event-media SELECT: owner, moderator, or linked to a visible event
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.storage_event_media_is_public(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(p_name, '') <> '' AND (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.status = 'published'
        AND e.cover_url LIKE '%/' || p_name
    )
    OR EXISTS (
      SELECT 1
      FROM public.event_media em
      WHERE em.url LIKE '%/' || p_name
        AND public.can_view_event(em.event_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.event_media_submissions s
      WHERE s.status = 'approved'
        AND s.url LIKE '%/' || p_name
        AND public.can_view_event(s.event_id)
    )
  );
$$;

REVOKE ALL ON FUNCTION public.storage_event_media_is_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storage_event_media_is_public(text) TO anon, authenticated;

DROP POLICY IF EXISTS "Event media select" ON storage.objects;
DROP POLICY IF EXISTS event_media_objects_select_public ON storage.objects;

CREATE POLICY event_media_objects_select_owner
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'event-media'
    AND owner = auth.uid()
  );

CREATE POLICY event_media_objects_select_moderator
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'event-media'
    AND public.is_moderator()
  );

CREATE POLICY event_media_objects_select_published
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'event-media'
    AND public.storage_event_media_is_public(name)
  );

-- Contest files stay in Storage; anon must not list them. Console still uses public URLs.
DROP POLICY IF EXISTS contest_media_public_read ON storage.objects;

CREATE POLICY contest_media_select_moderator
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'contest-media'
    AND public.is_moderator()
  );

CREATE POLICY contest_media_select_owner
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'contest-media'
    AND (storage.foldername(name))[1] = 'entries'
    AND (storage.foldername(name))[3] = (auth.uid())::text
  );
