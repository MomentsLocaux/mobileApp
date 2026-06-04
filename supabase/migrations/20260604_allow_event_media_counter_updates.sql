BEGIN;

-- Follow-up for MVP-P0-005/P0-010.
-- Adding event_media rows updates events.media_count through a trigger. That
-- internal counter update must bypass lifecycle write restrictions without
-- reopening creator edits on pending/published events.

CREATE OR REPLACE FUNCTION public.enforce_event_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_service_role boolean := auth.role() = 'service_role';
  v_is_moderator boolean := public.is_moderator();
  v_is_account_deletion boolean := current_setting('app.account_deletion', true) = 'on';
  v_is_event_stats_update boolean := current_setting('app.event_stats_update', true) = 'on';
  v_actor_id uuid := auth.uid();
BEGIN
  IF v_is_service_role OR v_is_moderator OR v_is_account_deletion OR v_is_event_stats_update THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_actor_id IS NULL OR NEW.creator_id IS DISTINCT FROM v_actor_id THEN
      RAISE EXCEPTION 'event creator must match authenticated user'
        USING ERRCODE = '42501';
    END IF;

    IF COALESCE(NEW.status::text, 'pending') NOT IN ('draft', 'pending') THEN
      RAISE EXCEPTION 'creators can only create draft or pending events'
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF v_actor_id IS NULL OR OLD.creator_id IS DISTINCT FROM v_actor_id THEN
      RAISE EXCEPTION 'only the event creator can update this event'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.creator_id IS DISTINCT FROM OLD.creator_id THEN
      RAISE EXCEPTION 'event creator cannot be changed'
        USING ERRCODE = '42501';
    END IF;

    IF OLD.status::text IN ('pending', 'published', 'archived') THEN
      RAISE EXCEPTION 'event status % is read-only for creators', OLD.status
        USING ERRCODE = '42501';
    END IF;

    IF OLD.status::text = 'draft' AND NEW.status::text NOT IN ('draft', 'pending') THEN
      RAISE EXCEPTION 'draft events can only remain draft or move to pending'
        USING ERRCODE = '42501';
    END IF;

    IF OLD.status::text = 'refused' AND NEW.status::text NOT IN ('refused', 'pending') THEN
      RAISE EXCEPTION 'refused events can only remain refused or move to pending'
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_event_media_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.event_stats_update', 'on', true);

  IF (TG_OP = 'INSERT') THEN
    UPDATE public.events
    SET media_count = media_count + 1
    WHERE id = NEW.event_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.events
    SET media_count = GREATEST(media_count - 1, 0)
    WHERE id = OLD.event_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_media_count ON public.event_media;
CREATE TRIGGER trg_event_media_count
AFTER INSERT OR DELETE ON public.event_media
FOR EACH ROW EXECUTE FUNCTION public.update_event_media_count();

NOTIFY pgrst, 'reload schema';

COMMIT;
