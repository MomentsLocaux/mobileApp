-- Patch events.cover_url with deterministic Picsum placeholders.
-- Target format: https://picsum.photos/seed/<event_id>-cover/1200/800

UPDATE public.events e
SET cover_url = FORMAT(
  'https://picsum.photos/seed/%s-cover/1200/800',
  e.id::text
)
WHERE e.id IS NOT NULL
  AND (
    e.cover_url LIKE 'https://placehold%'
    OR e.cover_url LIKE 'https://source.unsplash.com%'
  );
