-- Patch event_media URLs with deterministic Picsum placeholders.
-- Seed format target: https://picsum.photos/seed/<seed>/1200/800
-- Example: https://picsum.photos/seed/0b279117-1dda-482d-9e04-d3427f872f45-1/1200/800

WITH ranked AS (
  SELECT
    em.id,
    COALESCE(em.event_id::text, em.id::text) AS base_seed,
    ROW_NUMBER() OVER (
      PARTITION BY em.event_id
      ORDER BY em.created_at ASC, em.id ASC
    ) AS idx
  FROM public.event_media em
)
UPDATE public.event_media em
SET url = FORMAT(
  'https://picsum.photos/seed/%s-%s/1200/800',
  ranked.base_seed,
  ranked.idx
)
FROM ranked
WHERE ranked.id = em.id;

