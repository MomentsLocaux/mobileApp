BEGIN;

-- =====================================================
-- 1. EVENT STATUS ENUM
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname = 'event_status_mod_enum'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.event_status_mod_enum AS ENUM (
      'draft',
      'pending',
      'published',
      'refused',
      'archived'
    );
  END IF;
END
$$;

-- Drop existing CHECK constraints on events.status
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'events'
      AND c.contype = 'c'
      AND a.attname = 'status'
      AND a.attnum = ANY (c.conkey)
  LOOP
    EXECUTE format('ALTER TABLE public.events DROP CONSTRAINT %I', r.conname);
  END LOOP;
END
$$;

UPDATE public.events
SET status = 'published'
WHERE status IS NULL
   OR status::text NOT IN ('draft','pending','published','refused','archived');

ALTER TABLE public.events
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.events
  ALTER COLUMN status TYPE public.event_status_mod_enum
  USING status::text::public.event_status_mod_enum;

ALTER TABLE public.events
  ALTER COLUMN status SET DEFAULT 'published',
  ALTER COLUMN status SET NOT NULL;

COMMIT;


-- =====================================================
-- 2. MODERATION TARGET TYPE ENUM
-- =====================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname = 'moderation_target_type_mod_enum'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.moderation_target_type_mod_enum AS ENUM (
      'event',
      'comment',
      'user',
      'challenge',
      'media',
      'contest_entry'
    );
  END IF;
END
$$;

-- Drop CHECK constraints on moderation_actions.target_type
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'moderation_actions'
      AND c.contype = 'c'
      AND a.attname = 'target_type'
      AND a.attnum = ANY (c.conkey)
  LOOP
    EXECUTE format('ALTER TABLE public.moderation_actions DROP CONSTRAINT %I', r.conname);
  END LOOP;
END
$$;

UPDATE public.moderation_actions
SET target_type = 'event'
WHERE target_type IS NULL
   OR target_type::text NOT IN ('event','comment','user','challenge','media','contest_entry');

ALTER TABLE public.moderation_actions
  ALTER COLUMN target_type TYPE public.moderation_target_type_mod_enum
  USING target_type::text::public.moderation_target_type_mod_enum;

ALTER TABLE public.moderation_actions
  ALTER COLUMN target_type SET NOT NULL;

COMMIT;


-- =====================================================
-- 3. PROFILE STATUS + BAN SUPPORT
-- =====================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname = 'profile_status_mod_enum'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.profile_status_mod_enum AS ENUM (
      'active',
      'restricted',
      'suspended',
      'banned'
    );
  END IF;
END
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status public.profile_status_mod_enum;

UPDATE public.profiles
SET status = 'active'
WHERE status IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN status TYPE public.profile_status_mod_enum
  USING status::text::public.profile_status_mod_enum;

ALTER TABLE public.profiles
  ALTER COLUMN status SET DEFAULT 'active',
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ban_until timestamp with time zone;

COMMIT;


-- =====================================================
-- 4. REPORTS IMPROVEMENTS
-- =====================================================

BEGIN;

-- Add escalated status to reports.status CHECK constraint
ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_status_check;

ALTER TABLE public.reports
  ADD CONSTRAINT reports_status_check
  CHECK (status IN ('new','in_review','closed','escalated'));

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reports_reviewed_by_fkey'
      AND conrelid = 'public.reports'::regclass
  ) THEN
    ALTER TABLE public.reports
      ADD CONSTRAINT reports_reviewed_by_fkey
      FOREIGN KEY (reviewed_by)
      REFERENCES public.profiles(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

COMMIT;


-- =====================================================
-- 5. NOTIFICATION TYPE ENUM
-- =====================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname = 'notification_type_mod_enum'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.notification_type_mod_enum AS ENUM (
      'event_published',
      'event_soon',
      'lumo_reward',
      'mission_completed',
      'boost_expired',
      'social_follow',
      'social_like',
      'system',
      'event_refused',
      'event_request_changes',
      'warning_received',
      'user_banned',
      'media_approved',
      'media_rejected',
      'contest_entry_refused',
      'moderation_escalation'
    );
  END IF;
END
$$;

-- Drop CHECK constraint if exists
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'notifications'
      AND c.contype = 'c'
      AND a.attname = 'type'
      AND a.attnum = ANY (c.conkey)
  LOOP
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', r.conname);
  END LOOP;
END
$$;

UPDATE public.notifications
SET type = 'system'
WHERE type IS NULL;

ALTER TABLE public.notifications
  ALTER COLUMN type TYPE public.notification_type_mod_enum
  USING type::text::public.notification_type_mod_enum;

ALTER TABLE public.notifications
  ALTER COLUMN type SET NOT NULL;

COMMIT;
