-- MVP-LUMO-003 — Harden Lumo economy RPCs, caps, idempotency, RLS, flag.
-- ADR 004. Apply to DEV with human OK; UAT/prod separately.
--
-- Fixes:
-- 1) earn/spend wrote to missing public.transactions → use lumo_transactions
-- 2) Client could call earn_lumo(amount) → forbid; credit only via credit_lumo_by_rule
-- 3) Broad grants on wallets/lumo_* → revoke writes from anon/authenticated
-- 4) Feature flag app_config.gamification_enabled (default false)

-- ---------------------------------------------------------------------------
-- Flag
-- ---------------------------------------------------------------------------
INSERT INTO public.app_config (key, value)
VALUES ('gamification_enabled', 'false')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = now();

CREATE OR REPLACE FUNCTION public.is_gamification_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce(
    (SELECT value FROM public.app_config WHERE key = 'gamification_enabled' LIMIT 1),
    'false'
  )) IN ('true', '1', 'yes', 'on');
$$;

REVOKE ALL ON FUNCTION public.is_gamification_enabled() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_gamification_enabled() TO service_role;
-- Authenticated may read flag for UX (optional); keep locked — client uses EXPO flag.
GRANT EXECUTE ON FUNCTION public.is_gamification_enabled() TO authenticated;

-- ---------------------------------------------------------------------------
-- Idempotency column + unique key
-- ---------------------------------------------------------------------------
ALTER TABLE public.lumo_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS lumo_transactions_user_idempotency_uidx
  ON public.lumo_transactions (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RLS: owner SELECT only; no client writes
-- ---------------------------------------------------------------------------
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lumo_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lumo_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallets_select_own ON public.wallets;
CREATE POLICY wallets_select_own
  ON public.wallets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS lumo_transactions_select_own ON public.lumo_transactions;
CREATE POLICY lumo_transactions_select_own
  ON public.lumo_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS lumo_rules_select_active ON public.lumo_rules;
CREATE POLICY lumo_rules_select_active
  ON public.lumo_rules
  FOR SELECT
  TO authenticated
  USING (active IS TRUE);

REVOKE ALL ON TABLE public.wallets FROM anon, authenticated;
REVOKE ALL ON TABLE public.lumo_transactions FROM anon, authenticated;
REVOKE ALL ON TABLE public.lumo_rules FROM anon, authenticated;

GRANT SELECT ON TABLE public.wallets TO authenticated;
GRANT SELECT ON TABLE public.lumo_transactions TO authenticated;
GRANT SELECT ON TABLE public.lumo_rules TO authenticated;

-- ---------------------------------------------------------------------------
-- Core credit by rule (service_role / SECURITY DEFINER callers only)
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
  v_day_count integer;
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
-- Legacy earn_lumo: forbid client minting (broken table reference fixed → forbidden)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.earn_lumo(
  p_amount integer,
  p_reason text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'CLIENT_EARN_FORBIDDEN'
    USING HINT = 'Use server credit_lumo_by_rule after a validated trigger event';
END;
$$;

REVOKE ALL ON FUNCTION public.earn_lumo(integer, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.earn_lumo(integer, text, jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- spend_lumo: flag + lumo_transactions + wallet lock
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spend_lumo(
  p_amount integer,
  p_item_type text,
  p_item_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_new_balance bigint;
  v_transaction_id uuid;
  v_key text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF NOT public.is_gamification_enabled() THEN
    RAISE EXCEPTION 'GAMIFICATION_DISABLED';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  IF p_item_type IS NULL OR length(trim(p_item_type)) = 0 THEN
    RAISE EXCEPTION 'INVALID_ITEM';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text));

  UPDATE public.wallets
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE user_id = v_user_id
    AND balance >= p_amount
  RETURNING balance INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;

  v_key := CASE
    WHEN p_item_id IS NOT NULL THEN p_item_type || ':' || p_item_id::text || ':' || gen_random_uuid()::text
    ELSE p_item_type || ':' || gen_random_uuid()::text
  END;

  INSERT INTO public.lumo_transactions (
    user_id, amount, type, source, reason, metadata, idempotency_key
  )
  VALUES (
    v_user_id,
    p_amount,
    'debit',
    p_item_type,
    p_item_type,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('item_id', p_item_id),
    v_key
  )
  RETURNING id INTO v_transaction_id;

  RETURN json_build_object(
    'success', true,
    'balance', v_new_balance,
    'transaction_id', v_transaction_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.spend_lumo(integer, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_lumo(integer, text, uuid, jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- buy_item: gate on flag (spend_lumo already gates)
-- ---------------------------------------------------------------------------
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

  IF NOT public.is_gamification_enabled() THEN
    RAISE EXCEPTION 'GAMIFICATION_DISABLED';
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

  PERFORM public.log_activity(
    v_user_id,
    'purchase',
    v_item_id,
    jsonb_build_object('price', v_price)
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.buy_item(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_item(text) TO authenticated, service_role;
