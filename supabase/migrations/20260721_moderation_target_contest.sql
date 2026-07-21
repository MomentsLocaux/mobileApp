-- Allow moderation_actions to target contests (podium, publish, close, etc.).
-- Existing enum had contest_entry / challenge but not contest.

ALTER TYPE public.moderation_target_type_mod_enum ADD VALUE IF NOT EXISTS 'contest';
