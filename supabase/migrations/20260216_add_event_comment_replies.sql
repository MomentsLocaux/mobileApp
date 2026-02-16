-- Add threaded replies support for event comments.
-- Replies are comments linked to a parent comment.

ALTER TABLE public.event_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_comments_parent_comment_id_fkey'
      AND conrelid = 'public.event_comments'::regclass
  ) THEN
    ALTER TABLE public.event_comments
      ADD CONSTRAINT event_comments_parent_comment_id_fkey
      FOREIGN KEY (parent_comment_id)
      REFERENCES public.event_comments(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_event_comments_parent_comment_id
  ON public.event_comments(parent_comment_id);
