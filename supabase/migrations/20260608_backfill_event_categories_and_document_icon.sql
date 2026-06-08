-- P0: Backfill published events missing a category (generic map marker otherwise).
-- P2: Document that event_category.icon is legacy — map markers use client Lucide icons by slug.

COMMENT ON COLUMN public.event_category.icon IS
  'Legacy metadata label (e.g. theatre, shop). Map markers use client-side Lucide icons keyed by slug; this column is not used for map rendering.';

-- Bypass creator lifecycle guard for this one-off data fix (published rows are otherwise read-only).
ALTER TABLE public.events DISABLE TRIGGER trg_enforce_event_lifecycle;

UPDATE public.events e
SET category = c.id
FROM public.event_category c
WHERE e.category IS NULL
  AND e.status = 'published'
  AND e.visibility = 'public'
  AND (
    (e.id = '54311ac5-08ee-4d8a-9694-2305f53ed1c9' AND c.slug = 'nature-bienetre')
    OR (e.id = '7b92c06c-c82a-4a0e-bd44-d6a202324864' AND c.slug = 'marches-artisanat')
    OR (e.id = 'f8fa5f6e-f3af-4bcf-a0e2-566cab759910' AND c.slug = 'marches-artisanat')
    OR (e.id = '5bad6537-d11a-4a27-b8b4-3e76e4324262' AND c.slug = 'marches-artisanat')
    OR (e.id = '871fff88-655d-4fd8-923c-373ae8c9b8f2' AND c.slug = 'marches-artisanat')
  );

ALTER TABLE public.events ENABLE TRIGGER trg_enforce_event_lifecycle;
