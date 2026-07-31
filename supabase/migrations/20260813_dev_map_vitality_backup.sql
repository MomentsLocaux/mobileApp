-- DEV-only seed for map vitality visuals (heat / live pulse / boost).
-- Safe to re-run: uses backup table + ON CONFLICT DO NOTHING.
-- DO NOT apply on UAT/prod without explicit approval.

CREATE TABLE IF NOT EXISTS public._dev_map_vitality_backup (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  starts_at timestamptz,
  ends_at timestamptz,
  boosted_until timestamptz,
  comments_count integer,
  tags text[],
  seeded_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public._dev_map_vitality_backup IS
  'DEV backup of event fields mutated by map vitality seed. Revert via scripts/seed.';
