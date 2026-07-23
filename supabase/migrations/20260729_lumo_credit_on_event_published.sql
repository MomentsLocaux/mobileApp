-- Credit creator Lumo AFTER an event is held (ends_at past, still published).
-- Progressive amount by duration (metadata.tiers on rule event_held).
-- Replaces prior intent to credit on pending→published (never apply that approach).
-- Idempotency: event_held:{event_id} ; weekly_cap 2.
-- Quiet when gamification_enabled=false.
-- Do NOT apply without human validation. DEV first; UAT/prod separately.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ---------------------------------------------------------------------------
-- Honor weekly_cap in rule metadata (also used by other triggers)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.credit_lumo_by_rule(
  p_user_id uuid,
  p_trigger_event text,
  p_idempotency_key text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule record;
  v_amount bigint;
  v_daily_cap integer;
  v_weekly_cap integer;
  v_day_count integer;
  v_week_count integer;
  v_new_balance bigint;
  v_tx_id uuid;
  v_meta jsonb := coalesce(p_metadata, '{}'::jsonb);
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_USER';
  END IF;

  IF p_trigger_event IS NULL OR length(trim(p_trigger_event)) = 0 THEN
    RAISE EXCEPTION 'INVALID_TRIGGER';
  END IF;

  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY';
  END IF;

  IF NOT public.is_gamification_enabled() THEN
    RETURN json_build_object(
      'success', true,
      'skipped', true,
      'reason', 'GAMIFICATION_DISABLED',
      'balance', NULL,
      'amount', 0
    );
  END IF;

  SELECT id, amount INTO v_tx_id, v_amount
  FROM public.lumo_transactions
  WHERE user_id = p_user_id
    AND idempotency_key = p_idempotency_key
  LIMIT 1;

  IF v_tx_id IS NOT NULL THEN
    SELECT balance INTO v_new_balance FROM public.wallets WHERE user_id = p_user_id;
    RETURN json_build_object(
      'success', true,
      'idempotent', true,
      'amount', v_amount,
      'balance', v_new_balance,
      'transaction_id', v_tx_id
    );
  END IF;

  SELECT code, amount, metadata, description
  INTO v_rule
  FROM public.lumo_rules
  WHERE trigger_event = p_trigger_event
    AND active IS TRUE
  ORDER BY code
  LIMIT 1;

  IF v_rule.amount IS NULL OR v_rule.amount <= 0 THEN
    RETURN json_build_object(
      'success', true,
      'skipped', true,
      'reason', 'NO_ACTIVE_RULE',
      'amount', 0
    );
  END IF;

  v_amount := v_rule.amount;
  v_daily_cap := NULLIF((v_rule.metadata ->> 'daily_cap')::integer, 0);
  v_weekly_cap := NULLIF((v_rule.metadata ->> 'weekly_cap')::integer, 0);

  IF v_daily_cap IS NOT NULL THEN
    SELECT count(*)::integer INTO v_day_count
    FROM public.lumo_transactions
    WHERE user_id = p_user_id
      AND type = 'credit'
      AND source = p_trigger_event
      AND created_at >= date_trunc('day', now() AT TIME ZONE 'utc');

    IF v_day_count >= v_daily_cap THEN
      RETURN json_build_object(
        'success', true,
        'skipped', true,
        'reason', 'DAILY_CAP',
        'amount', 0,
        'daily_cap', v_daily_cap
      );
    END IF;
  END IF;

  IF v_weekly_cap IS NOT NULL THEN
    SELECT count(*)::integer INTO v_week_count
    FROM public.lumo_transactions
    WHERE user_id = p_user_id
      AND type = 'credit'
      AND source = p_trigger_event
      AND created_at >= date_trunc('week', now() AT TIME ZONE 'utc');

    IF v_week_count >= v_weekly_cap THEN
      RETURN json_build_object(
        'success', true,
        'skipped', true,
        'reason', 'WEEKLY_CAP',
        'amount', 0,
        'weekly_cap', v_weekly_cap
      );
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  INSERT INTO public.wallets (user_id, balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.wallets
  SET balance = balance + v_amount,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.lumo_transactions (
    user_id, amount, type, source, reason, metadata, idempotency_key
  )
  VALUES (
    p_user_id,
    v_amount,
    'credit',
    p_trigger_event,
    coalesce(v_rule.description, p_trigger_event),
    v_meta || jsonb_build_object('rule_code', v_rule.code),
    p_idempotency_key
  )
  RETURNING id INTO v_tx_id;

  RETURN json_build_object(
    'success', true,
    'amount', v_amount,
    'balance', v_new_balance,
    'transaction_id', v_tx_id,
    'rule_code', v_rule.code
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT id, amount INTO v_tx_id, v_amount
    FROM public.lumo_transactions
    WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key
    LIMIT 1;
    SELECT balance INTO v_new_balance FROM public.wallets WHERE user_id = p_user_id;
    RETURN json_build_object(
      'success', true,
      'idempotent', true,
      'amount', coalesce(v_amount, 0),
      'balance', v_new_balance,
      'transaction_id', v_tx_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.credit_lumo_by_rule(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_lumo_by_rule(uuid, text, text, jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- Rules: deactivate publish credit ; add event_held with duration tiers
-- ---------------------------------------------------------------------------
UPDATE public.lumo_rules
SET
  active = false,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'deactivated_by', '20260729_lumo_credit_event_held',
    'reason', 'Replaced by event_held after ends_at (progressive duration)'
  )
WHERE code = 'event_published_approved'
   OR trigger_event = 'event_published_approved';

INSERT INTO public.lumo_rules (code, description, amount, trigger_event, active, metadata)
VALUES (
  'event_held',
  'Événement tenu jusqu''à sa fin (montant selon durée)',
  150,
  'event_held',
  true,
  jsonb_build_object(
    'adr', 'ADR_004',
    'mechanism', 'M7_creator',
    'weekly_cap', 2,
    'tiers', jsonb_build_array(
      jsonb_build_object('max_hours', 2, 'amount', 20),
      jsonb_build_object('max_hours', 4, 'amount', 35),
      jsonb_build_object('max_hours', 8, 'amount', 50),
      jsonb_build_object('max_hours', 24, 'amount', 70),
      jsonb_build_object('max_hours', 72, 'amount', 90),
      jsonb_build_object('max_hours', 168, 'amount', 120),
      jsonb_build_object('max_hours', NULL, 'amount', 150)
    )
  )
)
ON CONFLICT (code) DO UPDATE
SET
  description = EXCLUDED.description,
  amount = EXCLUDED.amount,
  trigger_event = EXCLUDED.trigger_event,
  active = EXCLUDED.active,
  metadata = EXCLUDED.metadata;

-- ---------------------------------------------------------------------------
-- Resolve duration → tier amount
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lumo_amount_for_event_duration(p_hours numeric, p_tiers jsonb)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_tier jsonb;
  v_max numeric;
  v_amount bigint := 0;
BEGIN
  IF p_hours IS NULL OR p_hours < 0 THEN
    RETURN 0;
  END IF;

  IF p_tiers IS NULL OR jsonb_typeof(p_tiers) <> 'array' THEN
    RETURN 0;
  END IF;

  FOR v_tier IN SELECT value FROM jsonb_array_elements(p_tiers)
  LOOP
    v_amount := coalesce((v_tier ->> 'amount')::bigint, 0);
    IF v_tier ->> 'max_hours' IS NULL OR btrim(v_tier ->> 'max_hours') = '' THEN
      RETURN v_amount;
    END IF;
    v_max := (v_tier ->> 'max_hours')::numeric;
    IF p_hours < v_max THEN
      RETURN v_amount;
    END IF;
  END LOOP;

  RETURN v_amount;
END;
$$;

REVOKE ALL ON FUNCTION public.lumo_amount_for_event_duration(numeric, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lumo_amount_for_event_duration(numeric, jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Credit one completed published event (progressive amount)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.credit_event_held_lumo(p_event_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event record;
  v_rule record;
  v_hours numeric;
  v_amount bigint;
  v_weekly_cap integer;
  v_week_count integer;
  v_new_balance bigint;
  v_tx_id uuid;
  v_idempotency text;
  v_meta jsonb;
BEGIN
  IF p_event_id IS NULL THEN
    RETURN json_build_object('success', true, 'skipped', true, 'reason', 'INVALID_EVENT');
  END IF;

  IF NOT public.is_gamification_enabled() THEN
    RETURN json_build_object(
      'success', true,
      'skipped', true,
      'reason', 'GAMIFICATION_DISABLED',
      'amount', 0
    );
  END IF;

  SELECT id, creator_id, status, starts_at, ends_at
  INTO v_event
  FROM public.events
  WHERE id = p_event_id;

  IF v_event.id IS NULL THEN
    RETURN json_build_object('success', true, 'skipped', true, 'reason', 'EVENT_NOT_FOUND');
  END IF;

  IF v_event.creator_id IS NULL THEN
    RETURN json_build_object('success', true, 'skipped', true, 'reason', 'NO_CREATOR');
  END IF;

  IF v_event.status IS DISTINCT FROM 'published' THEN
    RETURN json_build_object('success', true, 'skipped', true, 'reason', 'NOT_PUBLISHED');
  END IF;

  IF v_event.ends_at IS NULL OR v_event.starts_at IS NULL THEN
    RETURN json_build_object('success', true, 'skipped', true, 'reason', 'MISSING_DATES');
  END IF;

  IF v_event.ends_at > now() THEN
    RETURN json_build_object('success', true, 'skipped', true, 'reason', 'NOT_ENDED');
  END IF;

  IF v_event.ends_at <= v_event.starts_at THEN
    RETURN json_build_object('success', true, 'skipped', true, 'reason', 'INVALID_DURATION');
  END IF;

  v_idempotency := 'event_held:' || v_event.id::text;

  SELECT id, amount INTO v_tx_id, v_amount
  FROM public.lumo_transactions
  WHERE user_id = v_event.creator_id
    AND idempotency_key = v_idempotency
  LIMIT 1;

  IF v_tx_id IS NOT NULL THEN
    SELECT balance INTO v_new_balance FROM public.wallets WHERE user_id = v_event.creator_id;
    RETURN json_build_object(
      'success', true,
      'idempotent', true,
      'amount', v_amount,
      'balance', v_new_balance,
      'transaction_id', v_tx_id,
      'event_id', v_event.id
    );
  END IF;

  SELECT code, amount, metadata, description
  INTO v_rule
  FROM public.lumo_rules
  WHERE code = 'event_held'
    AND active IS TRUE
  LIMIT 1;

  IF v_rule.code IS NULL THEN
    RETURN json_build_object('success', true, 'skipped', true, 'reason', 'NO_ACTIVE_RULE', 'amount', 0);
  END IF;

  v_hours := extract(epoch FROM (v_event.ends_at - v_event.starts_at)) / 3600.0;
  v_amount := public.lumo_amount_for_event_duration(v_hours, v_rule.metadata -> 'tiers');

  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN json_build_object('success', true, 'skipped', true, 'reason', 'ZERO_AMOUNT', 'amount', 0);
  END IF;

  v_weekly_cap := NULLIF((v_rule.metadata ->> 'weekly_cap')::integer, 0);
  IF v_weekly_cap IS NOT NULL THEN
    SELECT count(*)::integer INTO v_week_count
    FROM public.lumo_transactions
    WHERE user_id = v_event.creator_id
      AND type = 'credit'
      AND source = 'event_held'
      AND created_at >= date_trunc('week', now() AT TIME ZONE 'utc');

    IF v_week_count >= v_weekly_cap THEN
      RETURN json_build_object(
        'success', true,
        'skipped', true,
        'reason', 'WEEKLY_CAP',
        'amount', 0,
        'weekly_cap', v_weekly_cap,
        'event_id', v_event.id
      );
    END IF;
  END IF;

  v_meta := jsonb_build_object(
    'event_id', v_event.id,
    'duration_hours', round(v_hours::numeric, 2),
    'rule_code', v_rule.code,
    'credited_via', 'credit_event_held_lumo'
  );

  PERFORM pg_advisory_xact_lock(hashtext(v_event.creator_id::text));

  INSERT INTO public.wallets (user_id, balance)
  VALUES (v_event.creator_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.wallets
  SET balance = balance + v_amount,
      updated_at = now()
  WHERE user_id = v_event.creator_id
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.lumo_transactions (
    user_id, amount, type, source, reason, metadata, idempotency_key
  )
  VALUES (
    v_event.creator_id,
    v_amount,
    'credit',
    'event_held',
    coalesce(v_rule.description, 'event_held'),
    v_meta,
    v_idempotency
  )
  RETURNING id INTO v_tx_id;

  RETURN json_build_object(
    'success', true,
    'amount', v_amount,
    'balance', v_new_balance,
    'transaction_id', v_tx_id,
    'rule_code', v_rule.code,
    'event_id', v_event.id,
    'duration_hours', round(v_hours::numeric, 2)
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT id, amount INTO v_tx_id, v_amount
    FROM public.lumo_transactions
    WHERE user_id = v_event.creator_id AND idempotency_key = v_idempotency
    LIMIT 1;
    SELECT balance INTO v_new_balance FROM public.wallets WHERE user_id = v_event.creator_id;
    RETURN json_build_object(
      'success', true,
      'idempotent', true,
      'amount', coalesce(v_amount, 0),
      'balance', v_new_balance,
      'transaction_id', v_tx_id,
      'event_id', p_event_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.credit_event_held_lumo(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_event_held_lumo(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Batch + cron (no publish trigger)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_completed_event_lumo(p_limit integer DEFAULT 100)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 500));
  v_row record;
  v_result json;
  v_credited integer := 0;
  v_skipped integer := 0;
  v_processed integer := 0;
BEGIN
  IF NOT public.is_gamification_enabled() THEN
    RETURN json_build_object(
      'success', true,
      'skipped', true,
      'reason', 'GAMIFICATION_DISABLED',
      'processed', 0
    );
  END IF;

  FOR v_row IN
    SELECT e.id
    FROM public.events e
    WHERE e.status = 'published'
      AND e.ends_at IS NOT NULL
      AND e.ends_at <= now()
      AND e.creator_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.lumo_transactions t
        WHERE t.idempotency_key = 'event_held:' || e.id::text
      )
    ORDER BY e.ends_at ASC
    LIMIT v_limit
  LOOP
    v_processed := v_processed + 1;
    v_result := public.credit_event_held_lumo(v_row.id);
    IF coalesce((v_result ->> 'skipped')::boolean, false)
       OR coalesce((v_result ->> 'idempotent')::boolean, false) THEN
      IF coalesce((v_result ->> 'amount')::bigint, 0) > 0
         AND coalesce((v_result ->> 'idempotent')::boolean, false) THEN
        NULL;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    ELSIF coalesce((v_result ->> 'success')::boolean, false)
          AND coalesce((v_result ->> 'amount')::bigint, 0) > 0 THEN
      v_credited := v_credited + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'processed', v_processed,
    'credited', v_credited,
    'skipped', v_skipped
  );
END;
$$;

REVOKE ALL ON FUNCTION public.award_completed_event_lumo(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_completed_event_lumo(integer) TO service_role;

-- Ensure no publish-credit trigger remains if a prior draft was applied
DROP TRIGGER IF EXISTS trg_events_credit_lumo_on_published ON public.events;
DROP FUNCTION IF EXISTS public.credit_lumo_on_event_published();

DO $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'award-completed-event-lumo';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'award-completed-event-lumo',
  '35 * * * *',
  $$SELECT public.award_completed_event_lumo(100);$$
);

COMMIT;
