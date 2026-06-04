BEGIN;

-- MVP-P0-005: restrict creator-side event lifecycle transitions.
-- Mobile creators can create drafts/pending submissions, edit drafts/refused events,
-- and resubmit drafts/refused events to pending. Published, pending and archived
-- events are read-only for creators; moderation/service roles keep backend control.

CREATE OR REPLACE FUNCTION public.enforce_event_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_service_role boolean := auth.role() = 'service_role';
  v_is_moderator boolean := public.is_moderator();
  v_actor_id uuid := auth.uid();
BEGIN
  IF v_is_service_role OR v_is_moderator THEN
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

DROP TRIGGER IF EXISTS trg_enforce_event_lifecycle ON public.events;
CREATE TRIGGER trg_enforce_event_lifecycle
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_event_lifecycle();

NOTIFY pgrst, 'reload schema';

COMMIT;
