-- =============================================================================
-- PROPOSAL ONLY — DO NOT APPLY without human validation (AGENTS.md).
-- Source: project-management/decisions/ADR_004_LUMO_ECONOMY_FREEMIUM.md
-- Project inspected: moments-locaux-dev (prymkgkafaovhzopslea) — 2026-07-21
--
-- Current live lumo_rules (DEV) BEFORE this proposal:
--   checkin_base     | checkin          | 5    | active
--   MISSION_DAILY    | mission_complete | 150  | active  ← inflationary vs ADR
--   CONTEST_WIN      | contest_win      | 1200 | active  ← out of P0 scope
--
-- This script:
--   1) upserts ADR-aligned earn rules (amounts + caps in metadata)
--   2) deactivates non-P0 / inflationary legacy rules
--   3) proposes minimal shop_items sinks (boost + cosmetic)
--   4) proposes 1 daily + 1 weekly mission
--   5) verification SELECTs
--
-- Caps in metadata are documentation for backend enforcement (ticket MVP-LUMO-003).
-- Applying this seed alone does NOT enforce caps.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Earn rules (lumo_rules)
-- Unique key assumed: code (verify before apply: \d lumo_rules)
-- ---------------------------------------------------------------------------

INSERT INTO public.lumo_rules (code, description, amount, trigger_event, active, metadata)
VALUES
  (
    'checkin_base',
    'Check-in geo/QR validé (M1)',
    20,
    'checkin',
    true,
    jsonb_build_object(
      'adr', 'ADR_004',
      'mechanism', 'M1',
      'cap_per_event_per_user', 1,
      'daily_cap', 5,
      'notes', 'event-checkin Edge Function must call earn_lumo atomically'
    )
  ),
  (
    'mission_daily',
    'Mission quotidienne légère (M6)',
    12,
    'mission_daily',
    true,
    jsonb_build_object(
      'adr', 'ADR_004',
      'mechanism', 'M6',
      'cap_per_day_per_user', 1
    )
  ),
  (
    'mission_weekly',
    'Mission hebdomadaire (M7)',
    60,
    'mission_weekly',
    true,
    jsonb_build_object(
      'adr', 'ADR_004',
      'mechanism', 'M7',
      'cap_per_week_per_user', 1
    )
  ),
  (
    'event_published_approved',
    'Event publié après approbation modération (M7 path créateur)',
    50,
    'event_published_approved',
    true,
    jsonb_build_object(
      'adr', 'ADR_004',
      'mechanism', 'M7',
      'weekly_cap', 2
    )
  ),
  (
    'media_approved',
    'Contribution média approuvée (M8)',
    20,
    'media_approved',
    false,
    jsonb_build_object(
      'adr', 'ADR_004',
      'mechanism', 'M8',
      'requires_moderation', true,
      'wave', 'P1'
    )
  ),
  (
    'referral_activated',
    'Parrainage voisin activé (M12)',
    100,
    'referral_activated',
    false,
    jsonb_build_object(
      'adr', 'ADR_004',
      'mechanism', 'M12',
      'monthly_cap', 3,
      'wave', 'P2'
    )
  )
ON CONFLICT (code) DO UPDATE
SET
  description = EXCLUDED.description,
  amount = EXCLUDED.amount,
  trigger_event = EXCLUDED.trigger_event,
  active = EXCLUDED.active,
  metadata = EXCLUDED.metadata;

-- Deactivate legacy inflationary / out-of-scope rules (keep rows for audit).
UPDATE public.lumo_rules
SET
  active = false,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'deactivated_by', 'ADR_004_seed_proposal',
    'reason', 'Inflationary or out of P0 economy scope'
  )
WHERE code IN ('MISSION_DAILY', 'CONTEST_WIN')
   OR (trigger_event = 'mission_complete' AND code <> 'mission_daily');

-- ---------------------------------------------------------------------------
-- 2) Shop sinks (shop_items) — minimal P0/P1 catalogue
-- buy_item(p_item_key) spends price via spend_lumo
-- ---------------------------------------------------------------------------

INSERT INTO public.shop_items (type, key, title, description, price, data)
VALUES
  (
    'boost',
    'event_boost_24h',
    'Boost événement 24h',
    'Mise en avant carte/liste pendant 24 heures (M9)',
    100,
    jsonb_build_object(
      'adr', 'ADR_004',
      'mechanism', 'M9',
      'duration_hours', 24,
      'effect', 'event_visibility_boost'
    )
  ),
  (
    'cosmetic',
    'avatar_frame_local',
    'Cadre Ambassadeur',
    'Cadre de profil cosmétique (M10) — sink secondaire',
    60,
    jsonb_build_object(
      'adr', 'ADR_004',
      'mechanism', 'M10',
      'effect', 'avatar_frame'
    )
  )
ON CONFLICT (key) DO UPDATE
SET
  type = EXCLUDED.type,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  data = EXCLUDED.data;

-- ---------------------------------------------------------------------------
-- 3) Missions catalogue (1 daily + 1 weekly) — P1 activation
-- Live columns (DEV): id, title, description, kind, target, reward_lumo,
--   reward_xp, start_at, end_at, metadata
-- NOTE: no unique key on kind — script deletes prior ADR seeds then inserts.
-- ---------------------------------------------------------------------------

DELETE FROM public.missions
WHERE metadata->>'adr' = 'ADR_004';

INSERT INTO public.missions (
  title,
  description,
  kind,
  target,
  reward_lumo,
  reward_xp,
  start_at,
  end_at,
  metadata
)
VALUES
  (
    'Sortie du jour',
    'Ajoute 1 favori et ouvre 1 détail d’événement',
    'daily',
    2,
    12,
    0,
    NULL,
    NULL,
    jsonb_build_object(
      'adr', 'ADR_004',
      'mechanism', 'M6',
      'lumo_rule_code', 'mission_daily',
      'steps', jsonb_build_array('favorite_event', 'open_event_detail')
    )
  ),
  (
    'Week-end local',
    'Valide 3 check-ins sur des événements distincts cette semaine',
    'weekly',
    3,
    60,
    0,
    NULL,
    NULL,
    jsonb_build_object(
      'adr', 'ADR_004',
      'mechanism', 'M7',
      'lumo_rule_code', 'mission_weekly',
      'steps', jsonb_build_array('checkin', 'checkin', 'checkin')
    )
  );

COMMIT;

-- =============================================================================
-- Verification (run after apply)
-- =============================================================================
-- SELECT code, trigger_event, amount, active, metadata
-- FROM public.lumo_rules
-- ORDER BY active DESC, code;
--
-- SELECT key, type, title, price, data
-- FROM public.shop_items
-- WHERE data->>'adr' = 'ADR_004'
-- ORDER BY price;
--
-- SELECT title, kind, target, reward_lumo, metadata
-- FROM public.missions
-- WHERE metadata->>'adr' = 'ADR_004';
--
-- Expected active earn rules: checkin_base(20), mission_daily(12),
--   mission_weekly(60), event_published_approved(50)
-- Expected inactive: media_approved, referral_activated, MISSION_DAILY, CONTEST_WIN
