-- Wire Lumo credit when moderation publishes an event (pending → published).
-- Rule: lumo_rules.trigger_event = event_published_approved (50 Lumo, weekly_cap 2).
-- Idempotency: event_published_approved:{event_id}
-- Quiet when gamification_enabled=false (credit_lumo_by_rule skips).
-- Do NOT apply without human validation. DEV first; UAT/prod separately.

BEGIN;

-- ---------------------------------------------------------------------------
-- Honor weekly_cap in rule metadata (ADR 004 / event_published_approved)
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

  -- Idempotent replay
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
-- Trigger: pending → published credits creator (never blocks moderation)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.credit_lumo_on_event_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  IF tg_op <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT (OLD.status = 'pending' AND NEW.status = 'published') THEN
    RETURN NEW;
  END IF;

  IF NEW.creator_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_result := public.credit_lumo_by_rule(
      NEW.creator_id,
      'event_published_approved',
      'event_published_approved:' || NEW.id::text,
      jsonb_build_object(
        'event_id', NEW.id,
        'credited_via', 'credit_lumo_on_event_published'
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'credit_lumo_on_event_published failed event=% err=%', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_credit_lumo_on_published ON public.events;
CREATE TRIGGER trg_events_credit_lumo_on_published
  AFTER UPDATE OF status ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_lumo_on_event_published();

REVOKE ALL ON FUNCTION public.credit_lumo_on_event_published() FROM PUBLIC, anon, authenticated;

COMMIT;
