-- Direct messages use the existing notifications pipeline.
-- The new enum value must be committed before the next migration uses it.
-- Do NOT apply without human validation.

ALTER TYPE public.notification_type_mod_enum
  ADD VALUE IF NOT EXISTS 'direct_message';
