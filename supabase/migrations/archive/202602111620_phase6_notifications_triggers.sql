BEGIN;

CREATE OR REPLACE FUNCTION public.enqueue_notification(
  p_user_id uuid,
  p_type public.notification_type_mod_enum,
  p_title text,
  p_body text DEFAULT NULL,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (p_user_id, p_type, p_title, p_body, COALESCE(p_data, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_notification(uuid, public.notification_type_mod_enum, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_notification(uuid, public.notification_type_mod_enum, text, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.enqueue_notification(uuid, public.notification_type_mod_enum, text, text, jsonb) FROM authenticated;

CREATE OR REPLACE FUNCTION public.notify_event_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending' AND NEW.status = 'published' THEN
    PERFORM public.enqueue_notification(
      NEW.creator_id,
      'event_published',
      'Événement approuvé',
      'Votre événement est maintenant visible.',
      jsonb_build_object('eventId', NEW.id, 'status', NEW.status)
    );
  ELSIF OLD.status = 'pending' AND NEW.status = 'refused' THEN
    PERFORM public.enqueue_notification(
      NEW.creator_id,
      'event_refused',
      'Événement refusé',
      'Votre événement n''a pas été validé.',
      jsonb_build_object('eventId', NEW.id, 'status', NEW.status)
    );
  ELSIF OLD.status = 'pending' AND NEW.status = 'draft' THEN
    PERFORM public.enqueue_notification(
      NEW.creator_id,
      'event_request_changes',
      'Modifications demandées',
      'La modération vous a demandé des ajustements avant publication.',
      jsonb_build_object('eventId', NEW.id, 'status', NEW.status)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_warning_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.level >= 3 THEN
    RETURN NEW;
  END IF;

  PERFORM public.enqueue_notification(
    NEW.user_id,
    'warning_received',
    CASE WHEN NEW.level = 2 THEN 'Avertissement niveau 2' ELSE 'Avertissement' END,
    COALESCE(
      NULLIF(NEW.reason, ''),
      CASE
        WHEN NEW.level = 2 THEN 'Votre compte est temporairement restreint.'
        ELSE 'Un avertissement a été émis sur votre compte.'
      END
    ),
    jsonb_build_object('warningId', NEW.id, 'level', NEW.level)
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_profile_ban()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'banned'
     AND (
       OLD.status IS DISTINCT FROM NEW.status
       OR OLD.ban_until IS DISTINCT FROM NEW.ban_until
     ) THEN
    PERFORM public.enqueue_notification(
      NEW.id,
      'user_banned',
      'Compte bloqué',
      CASE
        WHEN NEW.ban_until IS NULL THEN 'Votre compte a été bloqué par la modération.'
        ELSE 'Votre compte est bloqué jusqu''au ' || to_char(NEW.ban_until, 'DD/MM/YYYY') || '.'
      END,
      jsonb_build_object('status', NEW.status, 'banUntil', NEW.ban_until)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_media_submission_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' THEN
    PERFORM public.enqueue_notification(
      NEW.author_id,
      'media_approved',
      'Photo approuvée',
      'Votre photo a été publiée sur l''événement.',
      jsonb_build_object('submissionId', NEW.id, 'eventId', NEW.event_id)
    );
  ELSIF NEW.status = 'rejected' THEN
    PERFORM public.enqueue_notification(
      NEW.author_id,
      'media_rejected',
      'Photo refusée',
      'Votre photo n''a pas été validée.',
      jsonb_build_object('submissionId', NEW.id, 'eventId', NEW.event_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_contest_entry_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'active' THEN
    PERFORM public.enqueue_notification(
      NEW.user_id,
      'system',
      'Participation validée',
      'Votre participation a été validée.',
      jsonb_build_object('entryId', NEW.id, 'contestId', NEW.contest_id, 'status', NEW.status)
    );
  ELSIF NEW.status IN ('hidden', 'removed') THEN
    PERFORM public.enqueue_notification(
      NEW.user_id,
      'contest_entry_refused',
      'Participation refusée',
      'Votre participation a été rejetée par la modération.',
      jsonb_build_object('entryId', NEW.id, 'contestId', NEW.contest_id, 'status', NEW.status)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_report_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'escalated' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.enqueue_notification(
      NEW.reporter_id,
      'moderation_escalation',
      'Signalement escaladé',
      'Votre signalement a été transmis pour un examen renforcé.',
      jsonb_build_object(
        'reportId', NEW.id,
        'targetType', NEW.target_type,
        'targetId', NEW.target_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_notify_status ON public.events;
CREATE TRIGGER trg_events_notify_status
AFTER UPDATE OF status ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.notify_event_status_transition();

DROP TRIGGER IF EXISTS trg_warnings_notify_insert ON public.warnings;
CREATE TRIGGER trg_warnings_notify_insert
AFTER INSERT ON public.warnings
FOR EACH ROW
EXECUTE FUNCTION public.notify_warning_created();

DROP TRIGGER IF EXISTS trg_profiles_notify_ban ON public.profiles;
CREATE TRIGGER trg_profiles_notify_ban
AFTER UPDATE OF status, ban_until ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.notify_profile_ban();

DROP TRIGGER IF EXISTS trg_event_media_submissions_notify_status ON public.event_media_submissions;
CREATE TRIGGER trg_event_media_submissions_notify_status
AFTER UPDATE OF status ON public.event_media_submissions
FOR EACH ROW
EXECUTE FUNCTION public.notify_media_submission_status();

DROP TRIGGER IF EXISTS trg_contest_entries_notify_status ON public.contest_entries;
CREATE TRIGGER trg_contest_entries_notify_status
AFTER UPDATE OF status ON public.contest_entries
FOR EACH ROW
EXECUTE FUNCTION public.notify_contest_entry_status();

DROP TRIGGER IF EXISTS trg_reports_notify_escalation ON public.reports;
CREATE TRIGGER trg_reports_notify_escalation
AFTER UPDATE OF status ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.notify_report_escalation();

COMMIT;
