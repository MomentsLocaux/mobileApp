-- Notifications: preference parity, digest cadence, boost cron, discovery enqueue, event refusal body.
-- Do NOT apply to production without human validation.

BEGIN;

-- ---------------------------------------------------------------------------
-- Digest queue (daily / weekly cadence for geo + followed-creator fan-out)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_digest_queue (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    notification_type  public.notification_type_mod_enum NOT NULL,
    title              text NOT NULL,
    body               text,
    data               jsonb NOT NULL DEFAULT '{}'::jsonb,
    digest_period      text NOT NULL CHECK (digest_period IN ('daily', 'weekly')),
    created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_digest_queue_user_period
    ON public.notification_digest_queue (user_id, digest_period, created_at);

ALTER TABLE public.notification_digest_queue ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.notification_digest_queue IS
    'Buffered notifications for users with notify_frequency daily|weekly; flushed by pg_cron.';

-- ---------------------------------------------------------------------------
-- Central delivery helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.deliver_user_notification(
    p_user_id uuid,
    p_type public.notification_type_mod_enum,
    p_title text,
    p_body text,
    p_data jsonb,
    p_pref_gate text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_freq text;
BEGIN
    IF p_user_id IS NULL THEN
        RETURN;
    END IF;

    SELECT coalesce(up.notify_frequency, 'instant')
    INTO v_freq
    FROM public.user_preferences up
    WHERE up.user_id = p_user_id;

    IF NOT FOUND THEN
        v_freq := 'instant';
    END IF;

    IF p_pref_gate = 'social' THEN
        IF coalesce((
            SELECT up.notify_social FROM public.user_preferences up WHERE up.user_id = p_user_id
        ), true) = false THEN
            RETURN;
        END IF;
    ELSIF p_pref_gate = 'rewards' THEN
        IF coalesce((
            SELECT up.notify_rewards FROM public.user_preferences up WHERE up.user_id = p_user_id
        ), true) = false THEN
            RETURN;
        END IF;
    ELSIF p_pref_gate = 'event_nearby' THEN
        IF coalesce((
            SELECT up.notify_event_nearby FROM public.user_preferences up WHERE up.user_id = p_user_id
        ), true) = false THEN
            RETURN;
        END IF;
    ELSIF p_pref_gate = 'event_reminders' THEN
        IF coalesce((
            SELECT up.notify_event_reminders FROM public.user_preferences up WHERE up.user_id = p_user_id
        ), true) = false THEN
            RETURN;
        END IF;
    ELSIF p_pref_gate = 'followed_creator' THEN
        IF coalesce((
            SELECT up.notify_followed_creator FROM public.user_preferences up WHERE up.user_id = p_user_id
        ), true) = false THEN
            RETURN;
        END IF;
    END IF;

    IF v_freq IN ('daily', 'weekly')
       AND p_type IN ('event_nearby_new', 'followed_creator_published') THEN
        INSERT INTO public.notification_digest_queue (
            user_id, notification_type, title, body, data, digest_period
        ) VALUES (
            p_user_id, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb), v_freq
        );
        RETURN;
    END IF;

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (p_user_id, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.deliver_user_notification(
    uuid, public.notification_type_mod_enum, text, text, jsonb, text
) FROM PUBLIC;

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
    PERFORM public.deliver_user_notification(
        p_user_id, p_type, p_title, p_body, p_data, NULL
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- Flush digests → one inbox/push row per user per run
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.flush_notification_digests(p_period text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer := 0;
BEGIN
    IF p_period NOT IN ('daily', 'weekly') THEN
        RAISE EXCEPTION 'invalid digest period: %', p_period;
    END IF;

    WITH batches AS (
        SELECT q.user_id, count(*) AS item_count
        FROM public.notification_digest_queue q
        JOIN public.user_preferences up ON up.user_id = q.user_id
        WHERE q.digest_period = p_period
          AND coalesce(up.notify_frequency, 'instant') = p_period
        GROUP BY q.user_id
    ),
    inserted AS (
        INSERT INTO public.notifications (user_id, type, title, body, data)
        SELECT
            b.user_id,
            'system',
            CASE WHEN p_period = 'daily' THEN 'Récap du jour' ELSE 'Récap de la semaine' END,
            format(
                'Vous avez %s nouvelle(s) alerte(s) événements.',
                b.item_count
            ),
            jsonb_build_object(
                'kind', 'notification_digest',
                'digestPeriod', p_period,
                'itemCount', b.item_count
            )
        FROM batches b
        RETURNING user_id
    )
    DELETE FROM public.notification_digest_queue q
    USING inserted i
    WHERE q.user_id = i.user_id
      AND q.digest_period = p_period;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.flush_notification_digests(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flush_notification_digests(text) TO service_role;

-- ---------------------------------------------------------------------------
-- Social triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_name text;
BEGIN
    SELECT display_name INTO v_name FROM public.profiles WHERE id = new.follower;

    PERFORM public.deliver_user_notification(
        new.following,
        'social_follow',
        'Nouveau follower',
        coalesce(v_name, 'Quelqu''un') || ' vous suit désormais.',
        jsonb_build_object('follower', new.follower, 'followerName', v_name),
        'social'
    );
    RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_creator uuid;
BEGIN
    SELECT creator_id INTO v_creator FROM public.events WHERE id = new.event_id;
    IF v_creator IS NULL THEN
        RETURN new;
    END IF;

    PERFORM public.deliver_user_notification(
        v_creator,
        'social_like',
        'Nouvelle mention J''aime',
        'Votre événement a reçu un J''aime.',
        jsonb_build_object('eventId', new.event_id, 'user_id', new.user_id),
        'social'
    );
    RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_mission_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_mission text;
BEGIN
    IF new.completed = false OR old.completed = true THEN
        RETURN new;
    END IF;

    SELECT title INTO v_mission FROM public.missions WHERE id = new.mission_id;

    PERFORM public.deliver_user_notification(
        new.user_id,
        'mission_completed',
        'Mission accomplie',
        coalesce(v_mission, 'Vous avez terminé une mission !'),
        jsonb_build_object('missionId', new.mission_id),
        'rewards'
    );

    PERFORM public.log_activity(new.user_id, 'mission_completed', new.mission_id, '{}'::jsonb);
    RETURN new;
END;
$$;

-- ---------------------------------------------------------------------------
-- Event status (refusal reason)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_event_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_refusal_body text;
BEGIN
    IF tg_op <> 'UPDATE' THEN
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
        v_refusal_body := coalesce(
            nullif(btrim(NEW.refusal_reason), ''),
            'Votre événement n''a pas été validé.'
        );
        PERFORM public.enqueue_notification(
            NEW.creator_id,
            'event_refused',
            'Événement refusé',
            v_refusal_body,
            jsonb_build_object(
                'eventId', NEW.id,
                'status', NEW.status,
                'refusalReason', NEW.refusal_reason
            )
        );
    ELSIF OLD.status = 'pending' AND NEW.status = 'draft' THEN
        PERFORM public.enqueue_notification(
            NEW.creator_id,
            'event_request_changes',
            'Modifications demandées',
            coalesce(
                nullif(btrim(NEW.refusal_reason), ''),
                'La modération vous a demandé des ajustements avant publication.'
            ),
            jsonb_build_object(
                'eventId', NEW.id,
                'status', NEW.status,
                'refusalReason', NEW.refusal_reason
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Fan-out: instant → notifications; daily/weekly → digest queue
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_event_published_fanout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_became_published boolean;
BEGIN
    v_became_published :=
        new.status = 'published'
        AND (tg_op = 'INSERT' OR old.status IS DISTINCT FROM 'published');

    IF NOT v_became_published THEN
        RETURN new;
    END IF;

    IF coalesce(new.visibility, 'public') = 'private' THEN
        RETURN new;
    END IF;

    IF new.creator_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, data)
        SELECT
            f.follower,
            'followed_creator_published',
            coalesce(pr.display_name, 'Un créateur') || ' a publié un événement',
            new.title,
            jsonb_build_object('eventId', new.id, 'creatorId', new.creator_id)
        FROM public.follows f
        LEFT JOIN public.user_preferences up ON up.user_id = f.follower
        LEFT JOIN public.profiles pr ON pr.id = new.creator_id
        WHERE f.following = new.creator_id
          AND f.follower <> new.creator_id
          AND coalesce(up.notify_followed_creator, true) = true
          AND coalesce(up.notify_frequency, 'instant') = 'instant'
          AND NOT EXISTS (
              SELECT 1 FROM public.notifications n
              WHERE n.user_id = f.follower
                AND n.type = 'followed_creator_published'
                AND n.data->>'eventId' = new.id::text
          );

        INSERT INTO public.notification_digest_queue (
            user_id, notification_type, title, body, data, digest_period
        )
        SELECT
            f.follower,
            'followed_creator_published',
            coalesce(pr.display_name, 'Un créateur') || ' a publié un événement',
            new.title,
            jsonb_build_object('eventId', new.id, 'creatorId', new.creator_id),
            up.notify_frequency
        FROM public.follows f
        JOIN public.user_preferences up ON up.user_id = f.follower
        LEFT JOIN public.profiles pr ON pr.id = new.creator_id
        WHERE f.following = new.creator_id
          AND f.follower <> new.creator_id
          AND coalesce(up.notify_followed_creator, true) = true
          AND coalesce(up.notify_frequency, 'instant') IN ('daily', 'weekly')
          AND NOT EXISTS (
              SELECT 1 FROM public.notification_digest_queue q
              WHERE q.user_id = f.follower
                AND q.notification_type = 'followed_creator_published'
                AND q.data->>'eventId' = new.id::text
          );
    END IF;

    IF new.location IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, data)
        SELECT
            up.user_id,
            'event_nearby_new',
            'Nouvel événement près de chez vous',
            new.title,
            jsonb_build_object('eventId', new.id, 'city', new.city)
        FROM public.user_preferences up
        WHERE up.home_location IS NOT NULL
          AND coalesce(up.notify_event_nearby, true) = true
          AND coalesce(up.notify_frequency, 'instant') = 'instant'
          AND (new.creator_id IS NULL OR up.user_id <> new.creator_id)
          AND st_dwithin(up.home_location, new.location, coalesce(up.notify_radius_km, 25) * 1000)
          AND (
              new.creator_id IS NULL
              OR NOT EXISTS (
                  SELECT 1 FROM public.follows f
                  WHERE f.following = new.creator_id AND f.follower = up.user_id
              )
          )
          AND NOT EXISTS (
              SELECT 1 FROM public.notifications n
              WHERE n.user_id = up.user_id
                AND n.type = 'event_nearby_new'
                AND n.data->>'eventId' = new.id::text
          );

        INSERT INTO public.notification_digest_queue (
            user_id, notification_type, title, body, data, digest_period
        )
        SELECT
            up.user_id,
            'event_nearby_new',
            'Nouvel événement près de chez vous',
            new.title,
            jsonb_build_object('eventId', new.id, 'city', new.city),
            up.notify_frequency
        FROM public.user_preferences up
        WHERE up.home_location IS NOT NULL
          AND coalesce(up.notify_event_nearby, true) = true
          AND coalesce(up.notify_frequency, 'instant') IN ('daily', 'weekly')
          AND (new.creator_id IS NULL OR up.user_id <> new.creator_id)
          AND st_dwithin(up.home_location, new.location, coalesce(up.notify_radius_km, 25) * 1000)
          AND (
              new.creator_id IS NULL
              OR NOT EXISTS (
                  SELECT 1 FROM public.follows f
                  WHERE f.following = new.creator_id AND f.follower = up.user_id
              )
          )
          AND NOT EXISTS (
              SELECT 1 FROM public.notification_digest_queue q
              WHERE q.user_id = up.user_id
                AND q.notification_type = 'event_nearby_new'
                AND q.data->>'eventId' = new.id::text
          );
    END IF;

    RETURN new;
END;
$$;

-- ---------------------------------------------------------------------------
-- Boost expiry + buy_item rewards gate
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_expired_boosts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    rec record;
BEGIN
    FOR rec IN
        SELECT id, user_id, item_id FROM public.active_boosts WHERE expires_at < now()
    LOOP
        PERFORM public.deliver_user_notification(
            rec.user_id,
            'boost_expired',
            'Boost expiré',
            'Votre boost est arrivé à expiration.',
            jsonb_build_object('boostId', rec.id, 'itemId', rec.item_id),
            'rewards'
        );
        DELETE FROM public.active_boosts WHERE id = rec.id;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.buy_item(p_item_key text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_item_id uuid;
    v_price integer;
    v_qty integer;
    v_result json;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED';
    END IF;

    SELECT id, price INTO v_item_id, v_price
    FROM public.shop_items
    WHERE key = p_item_key;

    IF v_item_id IS NULL THEN
        RAISE EXCEPTION 'ITEM_NOT_FOUND';
    END IF;

    PERFORM public.spend_lumo(v_price, 'shop_purchase', v_item_id);

    INSERT INTO public.user_inventory (user_id, item_id, quantity)
    VALUES (v_user_id, v_item_id, 1)
    ON CONFLICT (user_id, item_id) DO
        UPDATE SET quantity = public.user_inventory.quantity + 1,
                   acquired_at = now()
        WHERE public.user_inventory.user_id = v_user_id
          AND public.user_inventory.item_id = v_item_id;

    SELECT quantity INTO v_qty
    FROM public.user_inventory
    WHERE user_id = v_user_id AND item_id = v_item_id;

    v_result := json_build_object(
        'success', true,
        'item_id', v_item_id,
        'quantity', v_qty
    );

    PERFORM public.deliver_user_notification(
        v_user_id,
        'lumo_reward',
        'Achat confirmé',
        'Merci pour votre achat dans la boutique.',
        jsonb_build_object('itemId', v_item_id, 'price', v_price),
        'rewards'
    );

    PERFORM public.log_activity(v_user_id, 'purchase', v_item_id, jsonb_build_object('price', v_price));

    RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- Discovery: break-the-loop + life insight enqueue
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.discovery_enqueue_break_loop_pushes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer := 0;
BEGIN
    WITH candidates AS (
        SELECT
            er.user_id,
            er.id AS recommendation_id,
            er.event_id,
            e.title AS event_title
        FROM public.event_recommendations er
        JOIN public.events e ON e.id = er.event_id
        JOIN public.discovery_consents dc
          ON dc.user_id = er.user_id
         AND dc.enabled = true
         AND dc.personalization_enabled = true
        JOIN public.user_preferences up ON up.user_id = er.user_id
        WHERE er.recommendation_type = 'break_the_loop'
          AND er.valid_until > now()
          AND er.dismissed_at IS NULL
          AND e.starts_at > now()
          AND coalesce(up.push_enabled, true) = true
          AND coalesce(up.discovery_push_enabled, false) = true
          AND coalesce(up.break_loop_push_enabled, false) = true
    ),
    eligible AS (
        SELECT c.*
        FROM candidates c
        WHERE NOT EXISTS (
            SELECT 1 FROM public.notifications n
            WHERE n.user_id = c.user_id
              AND n.type = 'discovery_break_loop'
              AND n.data->>'recommendationId' = c.recommendation_id::text
        )
    )
    INSERT INTO public.notifications (user_id, type, title, body, data)
    SELECT
        e.user_id,
        'discovery_break_loop',
        'Sortir de la routine',
        e.event_title,
        jsonb_build_object(
            'recommendationId', e.recommendation_id,
            'eventId', e.event_id,
            'source', 'discovery_enqueue_break_loop_pushes_v1'
        )
    FROM eligible e;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.discovery_enqueue_break_loop_pushes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.discovery_enqueue_break_loop_pushes() TO service_role;

CREATE OR REPLACE FUNCTION public.discovery_enqueue_life_insight_pushes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer := 0;
BEGIN
    WITH eligible AS (
        SELECT di.id AS insight_id, di.user_id, di.title, di.body
        FROM public.discovery_insights di
        JOIN public.discovery_consents dc
          ON dc.user_id = di.user_id
         AND dc.enabled = true
         AND dc.personalization_enabled = true
        JOIN public.user_preferences up ON up.user_id = di.user_id
        WHERE di.valid_until > now()
          AND di.seen_at IS NULL
          AND coalesce(up.push_enabled, true) = true
          AND coalesce(up.discovery_push_enabled, false) = true
          AND coalesce(up.life_insight_push_enabled, false) = true
          AND NOT EXISTS (
              SELECT 1 FROM public.notifications n
              WHERE n.user_id = di.user_id
                AND n.type = 'discovery_life_insight'
                AND n.data->>'insightId' = di.id::text
          )
    )
    INSERT INTO public.notifications (user_id, type, title, body, data)
    SELECT
        e.user_id,
        'discovery_life_insight',
        coalesce(nullif(btrim(e.title), ''), 'Un conseil pour vous'),
        e.body,
        jsonb_build_object(
            'insightId', e.insight_id,
            'source', 'discovery_enqueue_life_insight_pushes_v1'
        )
    FROM eligible e;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.discovery_enqueue_life_insight_pushes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.discovery_enqueue_life_insight_pushes() TO service_role;

-- ---------------------------------------------------------------------------
-- pg_cron
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notification-digest-daily') THEN
        PERFORM cron.unschedule('notification-digest-daily');
    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notification-digest-weekly') THEN
        PERFORM cron.unschedule('notification-digest-weekly');
    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'boost-expiry-sweep') THEN
        PERFORM cron.unschedule('boost-expiry-sweep');
    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'discovery-life-insight-pushes') THEN
        PERFORM cron.unschedule('discovery-life-insight-pushes');
    END IF;
END $$;

SELECT cron.schedule(
    'notification-digest-daily',
    '0 7 * * *',
    $$SELECT public.flush_notification_digests('daily');$$
);

SELECT cron.schedule(
    'notification-digest-weekly',
    '0 7 * * 1',
    $$SELECT public.flush_notification_digests('weekly');$$
);

SELECT cron.schedule(
    'boost-expiry-sweep',
    '*/15 * * * *',
    $$SELECT public.delete_expired_boosts();$$
);

SELECT cron.schedule(
    'discovery-life-insight-pushes',
    '30 5 * * *',
    $$SELECT public.discovery_enqueue_life_insight_pushes();$$
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'discovery-push-opportunities') THEN
        PERFORM cron.unschedule('discovery-push-opportunities');
    END IF;
END $$;

SELECT cron.schedule(
    'discovery-push-opportunities',
    '*/30 * * * *',
    $$
    SELECT public.discovery_enqueue_right_now_pushes();
    SELECT public.discovery_enqueue_break_loop_pushes();
    $$
);

COMMIT;
