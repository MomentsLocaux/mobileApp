-- Bug reports: catalog of related pages, requalify legacy `page` values,
-- optional evidence attachment (private storage).

-- ---------------------------------------------------------------------------
-- 1) Page catalog
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bug_report_pages (
  id text PRIMARY KEY,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

INSERT INTO public.bug_report_pages (id, label, sort_order) VALUES
  ('home', 'Accueil', 10),
  ('map', 'Carte', 20),
  ('event_detail', 'Détail d''un moment', 30),
  ('event_create', 'Création / publication', 40),
  ('event_suggest', 'Suggestion depuis une affiche', 50),
  ('proposals', 'Propositions', 60),
  ('favorites', 'Favoris', 70),
  ('community', 'Communauté', 80),
  ('shop', 'Boutique', 90),
  ('missions', 'Missions', 100),
  ('profile', 'Profil', 110),
  ('settings', 'Paramètres', 120),
  ('notifications', 'Notifications', 130),
  ('lumia', 'Lumia', 140),
  ('contests', 'Concours', 150),
  ('onboarding', 'Onboarding', 160),
  ('auth', 'Connexion / compte', 170),
  ('creator', 'Espace diffuseur / créateur', 180),
  ('roadtrip', 'Roadtrip', 190),
  ('moderation', 'Modération (app)', 200),
  ('admin_console', 'Console d''administration', 210),
  ('website', 'Site web', 220),
  ('scraper', 'Collecte / scrapper', 230),
  ('emails', 'Emails', 240),
  ('qa', 'QA / tests', 250),
  ('other', 'Autre / non précisé', 999)
ON CONFLICT (id) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order;

ALTER TABLE public.bug_report_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bug_report_pages_select_auth ON public.bug_report_pages;
CREATE POLICY bug_report_pages_select_auth
  ON public.bug_report_pages
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS bug_report_pages_mod_write ON public.bug_report_pages;
CREATE POLICY bug_report_pages_mod_write
  ON public.bug_report_pages
  FOR ALL
  TO authenticated
  USING (public.is_moderator())
  WITH CHECK (public.is_moderator());

-- ---------------------------------------------------------------------------
-- 2) Attachment columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.bug_reports
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_mime_type text,
  ADD COLUMN IF NOT EXISTS attachment_name text;

-- ---------------------------------------------------------------------------
-- 3) Normalize legacy page values
-- Keep in sync with src/constants/bug-report-pages.ts (normalizeBugReportPage)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_bug_report_page(p_page text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text;
BEGIN
  IF p_page IS NULL OR btrim(p_page) = '' THEN
    RETURN 'other';
  END IF;

  v := lower(btrim(p_page));
  v := translate(
    v,
    'àâäáãåÀÂÄÁÃÅéèêëÉÈÊËìíîïÌÍÎÏòóôöõøÒÓÔÖÕØùúûüÙÚÛÜçÇñÑÿŸ',
    'aaaaaaAAAAAAeeeeEEEEiiiiIIIIooooooOOOOOOuuuuUUUUcCnNyY'
  );
  v := regexp_replace(v, '\s+', ' ', 'g');

  IF v IN (
    'home', 'map', 'event_detail', 'event_create', 'event_suggest', 'proposals',
    'favorites', 'community', 'shop', 'missions', 'profile', 'settings',
    'notifications', 'lumia', 'contests', 'onboarding', 'auth', 'creator',
    'roadtrip', 'moderation', 'admin_console', 'website', 'scraper', 'emails',
    'qa', 'other'
  ) THEN
    RETURN v;
  END IF;

  IF v IN ('/bug-report', 'bug-report', '/(tabs)/_layout', '/+not-found', 'tout')
     OR v LIKE '%bug report%'
     OR v LIKE '%spinner%' THEN
    RETURN 'other';
  END IF;

  IF v = 'qa' OR v LIKE 'qa:%' OR v LIKE 'qa %' THEN
    RETURN 'qa';
  END IF;

  IF v LIKE '%scrapper%' OR v LIKE '%scraper%' OR v LIKE '%collecte%' THEN
    RETURN 'scraper';
  END IF;

  IF v LIKE '%site web%' OR v LIKE '%website%' THEN
    RETURN 'website';
  END IF;

  IF v LIKE '%email welcome%' OR v LIKE '%emails auto%' OR v = 'emails' THEN
    RETURN 'emails';
  END IF;

  IF v LIKE '%roadtrip%' THEN
    RETURN 'roadtrip';
  END IF;

  IF v LIKE '%lumia%' OR v LIKE '%chatbot%' OR v LIKE '%/chatbot%' THEN
    RETURN 'lumia';
  END IF;

  IF v LIKE '%onboarding%' OR v LIKE '%autorisation ios%' OR v LIKE '%guide pas a pas%' THEN
    RETURN 'onboarding';
  END IF;

  IF v LIKE '%/auth%' OR v = '/login' OR v LIKE '%/login' OR v = 'auth' THEN
    RETURN 'auth';
  END IF;

  IF v LIKE '%concours%' OR v LIKE '%contest%' THEN
    RETURN 'contests';
  END IF;

  IF v LIKE '%boutique%' OR v LIKE '%/shop%' OR v LIKE '%premium%' OR v LIKE '%payante%' THEN
    RETURN 'shop';
  END IF;

  IF v LIKE '%notification%' OR v LIKE '%preferences email%' THEN
    RETURN 'notifications';
  END IF;

  IF v LIKE '%/settings%' OR v = 'settings' THEN
    RETURN 'settings';
  END IF;

  IF v LIKE '%favorit%' THEN
    RETURN 'favorites';
  END IF;

  IF v LIKE '%communaute%'
     OR v LIKE '%community%'
     OR v LIKE '%membres%'
     OR v LIKE '%/profile/invite%'
     OR v LIKE '%detail membre%' THEN
    RETURN 'community';
  END IF;

  IF v LIKE '%proposal%' OR v LIKE '%proposition%' THEN
    RETURN 'proposals';
  END IF;

  IF v LIKE '%suggest%' OR v LIKE '%suggestion%' THEN
    RETURN 'event_suggest';
  END IF;

  IF v LIKE '%creer-evenement%'
     OR v LIKE '%/events/create%'
     OR v LIKE '%publication%'
     OR v LIKE '%modifier-evenement%'
     OR v LIKE '%preview%' THEN
    RETURN 'event_create';
  END IF;

  IF v LIKE '%bottom sheet map%'
     OR v LIKE '%marker%'
     OR v LIKE '%drom-com%'
     OR v LIKE '%sortby%'
     OR v LIKE '%modale navigation%'
     OR v = 'recherche'
     OR v = '/map'
     OR v LIKE '%/(tabs)/map%'
     OR v LIKE '% map%'
     OR v ~ '(^|[[:space:]/])map([[:space:]/]|$)'
     OR (v LIKE '%carte%' AND v NOT LIKE '%page%') THEN
    RETURN 'map';
  END IF;

  IF v LIKE '%/events%'
     OR v LIKE '%page evenement%'
     OR v LIKE '%detail evenement%'
     OR v LIKE '%event card%'
     OR v LIKE '%eventcard%'
     OR v LIKE '%eventdetail%'
     OR v LIKE '%evenement%' THEN
    RETURN 'event_detail';
  END IF;

  IF v IN ('/home', '/', 'home')
     OR v LIKE '%homescreen%'
     OR v LIKE '%greeting%'
     OR v LIKE '%modale de triage%' THEN
    RETURN 'home';
  END IF;

  IF v LIKE '%profil%' OR v LIKE '%gamification%' THEN
    RETURN 'profile';
  END IF;

  IF v LIKE '%diffuseur%' OR v LIKE '%partenaire%' OR v LIKE '%creator%' OR v LIKE '%claim ownership%' THEN
    RETURN 'creator';
  END IF;

  IF v LIKE '%moderation%' THEN
    RETURN 'moderation';
  END IF;

  IF v LIKE '%mission%' THEN
    RETURN 'missions';
  END IF;

  IF v LIKE '%admin%' OR v LIKE '%console%' THEN
    RETURN 'admin_console';
  END IF;

  RETURN 'other';
END;
$$;

UPDATE public.bug_reports
SET page = public.normalize_bug_report_page(page);

ALTER TABLE public.bug_reports
  ALTER COLUMN page SET DEFAULT 'other';

UPDATE public.bug_reports
SET page = 'other'
WHERE page IS NULL OR btrim(page) = '';

ALTER TABLE public.bug_reports
  ALTER COLUMN page SET NOT NULL;

ALTER TABLE public.bug_reports
  DROP CONSTRAINT IF EXISTS bug_reports_page_fkey;

ALTER TABLE public.bug_reports
  ADD CONSTRAINT bug_reports_page_fkey
  FOREIGN KEY (page) REFERENCES public.bug_report_pages(id);

CREATE INDEX IF NOT EXISTS idx_bug_reports_page ON public.bug_reports(page);

-- ---------------------------------------------------------------------------
-- 4) Private storage bucket for evidence
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bug-report-attachments',
  'bug-report-attachments',
  false,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS bug_report_attachments_owner_insert ON storage.objects;
CREATE POLICY bug_report_attachments_owner_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'bug-report-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS bug_report_attachments_select ON storage.objects;
CREATE POLICY bug_report_attachments_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'bug-report-attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_moderator()
    )
  );

DROP POLICY IF EXISTS bug_report_attachments_delete ON storage.objects;
CREATE POLICY bug_report_attachments_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'bug-report-attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_moderator()
    )
  );
