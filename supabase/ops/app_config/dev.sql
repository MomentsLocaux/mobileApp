-- Run once on DEV (prymkgkafaovhzopslea) after applying migrations.
-- Dashboard SQL editor or: supabase db execute --file supabase/ops/app_config/dev.sql

INSERT INTO public.app_config (key, value)
VALUES
  ('supabase_project_url', 'https://prymkgkafaovhzopslea.supabase.co'),
  ('gamification_enabled', 'false')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = now();
