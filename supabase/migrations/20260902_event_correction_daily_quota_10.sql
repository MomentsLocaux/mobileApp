-- Raise community correction / duplicate daily quota from 5 to 10 (UTC day).
-- Mirrors EVENT_CORRECTION_DAILY_QUOTA in src/types/event-correction.ts.
-- Do not apply without human validation (UAT/prod). DEV may apply to unblock tests.

CREATE OR REPLACE FUNCTION public.enforce_event_correction_proposal_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_limit integer := 10;
BEGIN
  SELECT count(*)::integer
  INTO v_count
  FROM public.event_correction_proposals
  WHERE proposer_id = NEW.proposer_id
    AND created_at >= date_trunc('day', timezone('utc', now()));

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'EVENT_CORRECTION_QUOTA_EXCEEDED'
      USING ERRCODE = 'P0001',
            HINT = format('Limit is %s proposals per UTC day.', v_limit);
  END IF;

  RETURN NEW;
END;
$$;
