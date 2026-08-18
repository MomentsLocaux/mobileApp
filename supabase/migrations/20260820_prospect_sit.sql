-- SIT used by an OT website (detected from public HTML fingerprints).
ALTER TABLE public.prospect_leads
  ADD COLUMN IF NOT EXISTS sit_platform text,
  ADD COLUMN IF NOT EXISTS sit_label text,
  ADD COLUMN IF NOT EXISTS sit_confidence text,
  ADD COLUMN IF NOT EXISTS sit_evidence text,
  ADD COLUMN IF NOT EXISTS sit_checked_at timestamptz;

ALTER TABLE public.prospect_leads
  DROP CONSTRAINT IF EXISTS prospect_leads_sit_platform_check;
ALTER TABLE public.prospect_leads
  ADD CONSTRAINT prospect_leads_sit_platform_check
  CHECK (
    sit_platform IS NULL
    OR sit_platform IN (
      'tourism_system', 'apidae', 'tourinsoft', 'sitlor',
      'cirkwi', 'openagenda', 'unknown', 'unreachable'
    )
  );

ALTER TABLE public.prospect_leads
  DROP CONSTRAINT IF EXISTS prospect_leads_sit_confidence_check;
ALTER TABLE public.prospect_leads
  ADD CONSTRAINT prospect_leads_sit_confidence_check
  CHECK (
    sit_confidence IS NULL
    OR sit_confidence IN ('high', 'medium', 'low')
  );

COMMENT ON COLUMN public.prospect_leads.sit_platform IS
  'SIT detected from the organisation website HTML. OT only. Not Pages Blanches.';
