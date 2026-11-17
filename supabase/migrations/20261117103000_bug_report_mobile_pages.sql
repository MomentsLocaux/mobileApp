-- Mobile bug-report picker: pages that are actually deployed.
-- Historical ids stay in the catalog so existing reports keep their page.

INSERT INTO public.bug_report_pages (id, label, sort_order) VALUES
  ('messages', 'Messages', 85)
ON CONFLICT (id) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order;

UPDATE public.bug_report_pages
SET label = 'Agenda'
WHERE id = 'favorites';

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
    'favorites', 'community', 'messages', 'shop', 'missions', 'profile', 'settings',
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

  IF v LIKE '%favorit%' OR v LIKE '%agenda%' THEN
    RETURN 'favorites';
  END IF;

  IF v = 'messages' OR v = 'message' OR v LIKE '%/messages%' OR v LIKE '%conversation%' THEN
    RETURN 'messages';
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
