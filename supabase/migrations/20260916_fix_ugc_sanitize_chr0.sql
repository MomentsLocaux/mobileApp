-- Fix SCRUM-234 follow-up: chr(0) cannot be evaluated in PostgreSQL.
-- It raises SQLSTATE 54000 "null character not permitted" on every comment /
-- report / bug write, even when the payload has no NUL.
-- Human validation required before applying (AGENTS.md).

CREATE OR REPLACE FUNCTION public.strip_null_bytes(p_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  src bytea;
  pos integer;
BEGIN
  IF p_value IS NULL THEN
    RETURN NULL;
  END IF;
  -- text cannot hold NUL, but chr(0) still throws 54000 if used as a search
  -- argument. Strip on bytea instead. replace() has no bytea overload on PG17.
  src := convert_to(p_value, 'UTF8');
  LOOP
    pos := position('\x00'::bytea IN src);
    EXIT WHEN pos = 0;
    src := overlay(src PLACING '\x'::bytea FROM pos FOR 1);
  END LOOP;
  RETURN convert_from(src, 'UTF8');
END;
$$;

COMMENT ON FUNCTION public.strip_null_bytes(text) IS
  'Removes NUL bytes via bytea. Do not use chr(0): PostgreSQL rejects it with 54000.';

CREATE OR REPLACE FUNCTION public.sanitize_ugc_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'event_comments' THEN
    NEW.message := public.strip_null_bytes(NEW.message);
  ELSIF TG_TABLE_NAME = 'reports' THEN
    NEW.reason := public.strip_null_bytes(COALESCE(NEW.reason, ''));
  ELSIF TG_TABLE_NAME = 'bug_reports' THEN
    NEW.description := public.strip_null_bytes(COALESCE(NEW.description, ''));
    IF auth.uid() IS NOT NULL
       AND NOT public.is_moderator()
       AND char_length(NEW.description) > 4000 THEN
      RAISE EXCEPTION 'UGC_TOO_LONG'
        USING ERRCODE = 'P0001',
              HINT = 'Description limitée à 4000 caractères.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 20260909 left chr(0) on the comments rate-limit trigger; 20260914 removed it
-- from this function, but recreate the safe body so both histories converge.
CREATE OR REPLACE FUNCTION public.enforce_user_write_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.is_moderator() THEN
    RETURN NEW;
  END IF;

  v_ok := public.consume_write_rate_limit(
    'uid:' || auth.uid()::text,
    TG_ARGV[0],
    TG_ARGV[1]::integer
  );
  IF NOT v_ok THEN
    RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED'
      USING ERRCODE = 'P0001',
            HINT = 'Réessaie dans une minute.';
  END IF;
  RETURN NEW;
END;
$$;
