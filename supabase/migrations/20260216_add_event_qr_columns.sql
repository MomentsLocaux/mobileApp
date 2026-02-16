-- Add unique QR token support for events.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS qr_token text,
  ADD COLUMN IF NOT EXISTS qr_generated_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_events_qr_token_unique
  ON public.events (qr_token)
  WHERE qr_token IS NOT NULL;

-- Backfill already published events that don't have a QR token yet.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE public.events
SET
  qr_token = replace(gen_random_uuid()::text, '-', ''),
  qr_generated_at = now()
WHERE status = 'published'
  AND qr_token IS NULL;
