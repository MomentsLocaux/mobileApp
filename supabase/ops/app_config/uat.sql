-- Run once on UAT (ieehuzeotwagkkprohjr) after applying migrations.

INSERT INTO public.app_config (key, value)
VALUES ('supabase_project_url', 'https://ieehuzeotwagkkprohjr.supabase.co')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = now();
