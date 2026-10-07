-- Blog : file éditoriale alimentée par l'engagement, publiée seulement après modération.
--
-- Poids (BLOG_SCORE_V1, à garder alignés avec src/lib/blog/engine.ts du site
-- et src/blog/engine.ts de la console) :
--   J'aime ×3, vues ×1, présences ×8, commentaires ×5, favoris ×2
--   note : (moyenne - 3) × nombre × 4, seulement à partir de 5 avis, plancher 0
--   demi-vie 21 jours, fenêtre ±21 jours, seuil 24
-- Les vues ne qualifient jamais un article seules.
--
-- Automatisation : appeler propose_blog_highlights depuis la console,
-- ou une fois par jour via pg_cron (non activé ici) :
--   select cron.schedule(
--     'blog-highlights',
--     '15 6 * * *',
--     $$select public.propose_blog_highlights(8)$$
--   );

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  kind text NOT NULL CHECK (kind IN ('news', 'highlight')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected')),
  title text NOT NULL CHECK (char_length(btrim(title)) > 0),
  excerpt text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  cover_url text,
  city text,
  venue_name text,
  event_id uuid REFERENCES public.events (id) ON DELETE SET NULL,
  starts_at timestamptz,
  is_free boolean,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'engagement')),
  score integer,
  score_version integer,
  signals jsonb,
  editor_note text,
  proposed_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  reviewed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_one_open_highlight
  ON public.blog_posts (event_id)
  WHERE event_id IS NOT NULL
    AND kind = 'highlight'
    AND status IN ('pending', 'published');

CREATE INDEX IF NOT EXISTS blog_posts_published_idx
  ON public.blog_posts (published_at DESC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS blog_posts_pending_idx
  ON public.blog_posts (proposed_at DESC)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.touch_blog_posts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    NEW.published_at = coalesce(NEW.published_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_blog_posts ON public.blog_posts;
CREATE TRIGGER trg_touch_blog_posts
  BEFORE INSERT OR UPDATE ON public.blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_blog_posts();

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blog_posts_moderator_all ON public.blog_posts;
CREATE POLICY blog_posts_moderator_all
  ON public.blog_posts
  FOR ALL
  TO authenticated
  USING (public.is_moderator())
  WITH CHECK (public.is_moderator());

REVOKE ALL ON public.blog_posts FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;

CREATE OR REPLACE FUNCTION public.propose_blog_highlights(p_limit integer DEFAULT 8)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := least(greatest(coalesce(p_limit, 8), 1), 20);
  v_considered integer := 0;
  v_inserted integer := 0;
  rec record;
  ranked record;
  v_likes integer;
  v_views integer;
  v_checkins integer;
  v_comments integer;
  v_favorites integer;
  v_rating_count integer;
  v_rating_avg numeric;
  v_raw integer;
  v_score integer;
  v_human integer;
  v_age numeric;
  v_decay numeric;
  v_end timestamptz;
  v_slug text;
  v_base_slug text;
  v_excerpt text;
  v_body text;
  v_note text;
  v_place text;
  v_when text;
  v_old_score numeric;
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') THEN
    IF auth.role() = 'anon' OR NOT public.is_moderator() THEN
      RAISE EXCEPTION 'not allowed';
    END IF;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _blog_ranked (
    event_id uuid PRIMARY KEY,
    score integer NOT NULL,
    raw_score integer NOT NULL,
    timing text NOT NULL,
    likes integer NOT NULL,
    views integer NOT NULL,
    checkins integer NOT NULL,
    comments integer NOT NULL,
    favorites integer NOT NULL,
    rating_avg numeric NOT NULL,
    rating_count integer NOT NULL
  ) ON COMMIT DROP;

  TRUNCATE _blog_ranked;

  FOR rec IN
    SELECT
      e.id,
      e.title,
      e.starts_at,
      e.ends_at,
      e.rating_avg,
      e.rating_count
    FROM public.events e
    WHERE e.status = 'published'
      AND e.starts_at IS NOT NULL
      AND e.starts_at <= now() + interval '21 days'
      AND coalesce(e.ends_at, e.starts_at) >= now() - interval '21 days'
    ORDER BY e.starts_at DESC
    LIMIT 400
  LOOP
    v_considered := v_considered + 1;
    v_likes := 0;
    v_views := 0;
    v_checkins := 0;
    v_comments := 0;
    v_favorites := 0;

    IF to_regclass('public.event_likes') IS NOT NULL THEN
      EXECUTE 'SELECT count(*)::integer FROM public.event_likes WHERE event_id = $1'
        INTO v_likes USING rec.id;
    END IF;
    IF to_regclass('public.event_views') IS NOT NULL THEN
      EXECUTE 'SELECT count(*)::integer FROM public.event_views WHERE event_id = $1'
        INTO v_views USING rec.id;
    END IF;
    IF to_regclass('public.event_checkins') IS NOT NULL THEN
      EXECUTE 'SELECT count(*)::integer FROM public.event_checkins WHERE event_id = $1'
        INTO v_checkins USING rec.id;
    END IF;
    IF to_regclass('public.event_comments') IS NOT NULL THEN
      EXECUTE 'SELECT count(*)::integer FROM public.event_comments WHERE event_id = $1'
        INTO v_comments USING rec.id;
    END IF;
    IF to_regclass('public.favorites') IS NOT NULL THEN
      EXECUTE 'SELECT count(*)::integer FROM public.favorites WHERE event_id = $1'
        INTO v_favorites USING rec.id;
    END IF;

    v_rating_count := coalesce(rec.rating_count, 0);
    v_rating_avg := coalesce(rec.rating_avg, 0);
    v_raw := (v_likes * 3) + v_views + (v_checkins * 8) + (v_comments * 5) + (v_favorites * 2);
    IF v_rating_count >= 5 THEN
      v_raw := v_raw + greatest(0, round((v_rating_avg - 3) * v_rating_count * 4))::integer;
    END IF;

    v_end := coalesce(rec.ends_at, rec.starts_at);
    IF v_end < now() THEN
      v_age := extract(epoch FROM (now() - v_end)) / 86400.0;
    ELSE
      v_age := greatest(0, extract(epoch FROM (rec.starts_at - now())) / 86400.0 - 14);
    END IF;
    v_decay := power(0.5::numeric, v_age / 21.0);
    v_score := round(v_raw * v_decay)::integer;

    v_human := v_likes + v_checkins + v_comments + v_favorites;
    IF v_rating_count >= 5 AND v_rating_avg >= 4 THEN
      v_human := v_human + 1;
    END IF;

    IF v_human > 0 AND v_score >= 24 THEN
      INSERT INTO _blog_ranked (
        event_id, score, raw_score, timing, likes, views, checkins, comments, favorites, rating_avg, rating_count
      ) VALUES (
        rec.id,
        v_score,
        v_raw,
        CASE WHEN v_end < now() THEN 'recap' ELSE 'upcoming' END,
        v_likes, v_views, v_checkins, v_comments, v_favorites, v_rating_avg, v_rating_count
      )
      ON CONFLICT (event_id) DO NOTHING;
    END IF;
  END LOOP;

  FOR ranked IN
    SELECT
      r.*,
      e.title,
      e.description,
      e.city,
      e.venue_name,
      e.starts_at,
      e.cover_url,
      e.is_free
    FROM _blog_ranked r
    JOIN public.events e ON e.id = r.event_id
    ORDER BY r.score DESC, e.starts_at DESC
  LOOP
    EXIT WHEN v_inserted >= v_limit;

    IF EXISTS (
      SELECT 1
      FROM public.blog_posts bp
      WHERE bp.event_id = ranked.event_id
        AND bp.status IN ('pending', 'published')
    ) THEN
      CONTINUE;
    END IF;

    v_old_score := NULL;
    SELECT bp.score
      INTO v_old_score
    FROM public.blog_posts bp
    WHERE bp.event_id = ranked.event_id
      AND bp.status = 'rejected'
      AND bp.reviewed_at > now() - interval '90 days'
    ORDER BY bp.reviewed_at DESC
    LIMIT 1;

    IF v_old_score IS NOT NULL AND ranked.score < v_old_score * 1.5 THEN
      CONTINUE;
    END IF;

    v_base_slug := left(trim(both '-' FROM regexp_replace(
      translate(
        lower(coalesce(ranked.title, 'article')),
        'àáâäçèéêëìíîïñòóôöùúûüÿœæ',
        'aaaaceeeeiiiinoooouuuuyoe'
      ),
      '[^a-z0-9]+',
      '-',
      'g'
    )), 72);
    IF v_base_slug IS NULL OR v_base_slug = '' THEN
      v_base_slug := 'article';
    END IF;
    v_slug := v_base_slug;
    IF EXISTS (SELECT 1 FROM public.blog_posts bp WHERE bp.slug = v_slug) THEN
      v_slug := left(v_base_slug, 60) || '-' || left(replace(ranked.event_id::text, '-', ''), 6);
    END IF;

    v_excerpt := left(regexp_replace(coalesce(ranked.description, ''), '\s+', ' ', 'g'), 180);
    IF char_length(btrim(v_excerpt)) < 40 THEN
      v_excerpt := 'Cet événement ressort parmi les sorties les plus suivies.';
    END IF;

    v_body := btrim(regexp_replace(coalesce(ranked.description, ''), '\s+', ' ', 'g'));
    IF char_length(v_body) < 40 THEN
      v_body := 'Les informations publiques de cet événement sont encore brèves. Complétez ce texte avant publication.';
    END IF;

    v_when := to_char(ranked.starts_at AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY HH24:MI');
    v_place := nullif(concat_ws(', ', nullif(btrim(ranked.venue_name), ''), nullif(btrim(ranked.city), '')), '');
    v_body := v_body || E'\n\n' || v_when || coalesce(' — ' || v_place, '') || '.';
    IF ranked.is_free IS TRUE THEN
      v_body := v_body || ' Entrée libre.';
    ELSIF ranked.is_free IS FALSE THEN
      v_body := v_body || ' Entrée payante.';
    END IF;

    IF ranked.checkins > 0 THEN
      v_body := v_body || E'\n\nDes personnes ont confirmé leur présence sur place.';
    END IF;
    IF ranked.comments >= 2 THEN
      v_body := v_body || E'\n\nL''événement a déjà suscité des échanges.';
    END IF;
    IF ranked.rating_count >= 5 AND ranked.rating_avg >= 4 THEN
      v_body := v_body || E'\n\nLes retours laissés jusqu''ici sont positifs.';
    END IF;
    IF ranked.likes >= 8 THEN
      v_body := v_body || E'\n\nIl fait partie des sorties les plus gardées en ce moment.';
    END IF;

    v_note := format(
      'Proposition automatique (score %s, brut %s, v1, %s). J''aime %s, vues %s, présences %s, commentaires %s, favoris %s, note %s (%s avis). Les vues ne suffisent pas à proposer un article. Relisez le texte avant publication.',
      ranked.score,
      ranked.raw_score,
      CASE WHEN ranked.timing = 'recap' THEN 'récit' ELSE 'à venir' END,
      ranked.likes,
      ranked.views,
      ranked.checkins,
      ranked.comments,
      ranked.favorites,
      ranked.rating_avg,
      ranked.rating_count
    );

    INSERT INTO public.blog_posts (
      slug, kind, status, title, excerpt, body, cover_url, city, venue_name,
      event_id, starts_at, is_free, source, score, score_version, signals, editor_note, proposed_at
    ) VALUES (
      v_slug,
      'highlight',
      'pending',
      left(btrim(ranked.title), 180),
      v_excerpt,
      v_body,
      ranked.cover_url,
      ranked.city,
      ranked.venue_name,
      ranked.event_id,
      ranked.starts_at,
      ranked.is_free,
      'engagement',
      ranked.score,
      1,
      jsonb_build_object(
        'likes', ranked.likes,
        'views', ranked.views,
        'checkins', ranked.checkins,
        'comments', ranked.comments,
        'favorites', ranked.favorites,
        'ratingAvg', ranked.rating_avg,
        'ratingCount', ranked.rating_count
      ),
      v_note,
      now()
    );

    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'considered', v_considered,
    'qualified', (SELECT count(*) FROM _blog_ranked)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.propose_blog_highlights(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.propose_blog_highlights(integer) TO authenticated, service_role;
