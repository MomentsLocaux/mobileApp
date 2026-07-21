-- Add contest_results notification type for jury announcement fan-out.
ALTER TYPE public.notification_type_mod_enum ADD VALUE IF NOT EXISTS 'contest_results';
