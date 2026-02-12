BEGIN;

CREATE TABLE IF NOT EXISTS public.event_engagement_stats (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  views_count integer NOT NULL DEFAULT 0 CHECK (views_count >= 0),
  likes_count integer NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  comments_count integer NOT NULL DEFAULT 0 CHECK (comments_count >= 0),
  favorites_count integer NOT NULL DEFAULT 0 CHECK (favorites_count >= 0),
  checkins_count integer NOT NULL DEFAULT 0 CHECK (checkins_count >= 0),
  shares_count integer NOT NULL DEFAULT 0 CHECK (shares_count >= 0),
  engagement_score integer NOT NULL DEFAULT 0 CHECK (engagement_score >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_engagement_stats_creator_id
  ON public.event_engagement_stats (creator_id);

CREATE INDEX IF NOT EXISTS idx_event_engagement_stats_engagement_score
  ON public.event_engagement_stats (engagement_score DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.creator_engagement_stats (
  creator_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_events integer NOT NULL DEFAULT 0 CHECK (total_events >= 0),
  total_views integer NOT NULL DEFAULT 0 CHECK (total_views >= 0),
  total_likes integer NOT NULL DEFAULT 0 CHECK (total_likes >= 0),
  total_comments integer NOT NULL DEFAULT 0 CHECK (total_comments >= 0),
  total_followers integer NOT NULL DEFAULT 0 CHECK (total_followers >= 0),
  total_checkins integer NOT NULL DEFAULT 0 CHECK (total_checkins >= 0),
  engagement_score integer NOT NULL DEFAULT 0 CHECK (engagement_score >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.creator_fans (
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fan_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  xp integer NOT NULL DEFAULT 0 CHECK (xp >= 0),
  level integer NOT NULL DEFAULT 1 CHECK (level >= 1),
  super_fan boolean NOT NULL DEFAULT false,
  interactions_count integer NOT NULL DEFAULT 0 CHECK (interactions_count >= 0),
  last_interaction_at timestamptz DEFAULT now(),
  PRIMARY KEY (creator_id, fan_id)
);

CREATE INDEX IF NOT EXISTS idx_creator_fans_creator_xp
  ON public.creator_fans (creator_id, xp DESC, interactions_count DESC);

CREATE INDEX IF NOT EXISTS idx_creator_fans_fan_id
  ON public.creator_fans (fan_id);

CREATE OR REPLACE FUNCTION public.refresh_creator_engagement_stats(p_creator_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_events integer := 0;
  v_total_views integer := 0;
  v_total_likes integer := 0;
  v_total_comments integer := 0;
  v_total_followers integer := 0;
  v_total_checkins integer := 0;
  v_engagement integer := 0;
BEGIN
  IF p_creator_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*)
  INTO v_total_events
  FROM public.events e
  WHERE e.creator_id = p_creator_id;

  SELECT
    COALESCE(SUM(es.views_count), 0),
    COALESCE(SUM(es.likes_count), 0),
    COALESCE(SUM(es.comments_count), 0),
    COALESCE(SUM(es.checkins_count), 0),
    COALESCE(SUM(es.engagement_score), 0)
  INTO
    v_total_views,
    v_total_likes,
    v_total_comments,
    v_total_checkins,
    v_engagement
  FROM public.event_engagement_stats es
  WHERE es.creator_id = p_creator_id;

  SELECT COUNT(*)
  INTO v_total_followers
  FROM public.follows f
  WHERE f.following = p_creator_id;

  INSERT INTO public.creator_engagement_stats (
    creator_id,
    total_events,
    total_views,
    total_likes,
    total_comments,
    total_followers,
    total_checkins,
    engagement_score,
    updated_at
  )
  VALUES (
    p_creator_id,
    v_total_events,
    v_total_views,
    v_total_likes,
    v_total_comments,
    v_total_followers,
    v_total_checkins,
    v_engagement,
    now()
  )
  ON CONFLICT (creator_id)
  DO UPDATE SET
    total_events = EXCLUDED.total_events,
    total_views = EXCLUDED.total_views,
    total_likes = EXCLUDED.total_likes,
    total_comments = EXCLUDED.total_comments,
    total_followers = EXCLUDED.total_followers,
    total_checkins = EXCLUDED.total_checkins,
    engagement_score = EXCLUDED.engagement_score,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_event_engagement_stats(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id uuid;
  v_views integer := 0;
  v_likes integer := 0;
  v_comments integer := 0;
  v_favorites integer := 0;
  v_checkins integer := 0;
  v_shares integer := 0;
  v_score integer := 0;
BEGIN
  IF p_event_id IS NULL THEN
    RETURN;
  END IF;

  SELECT e.creator_id
  INTO v_creator_id
  FROM public.events e
  WHERE e.id = p_event_id;

  IF v_creator_id IS NULL THEN
    DELETE FROM public.event_engagement_stats
    WHERE event_id = p_event_id;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_views FROM public.event_views ev WHERE ev.event_id = p_event_id;
  SELECT COUNT(*) INTO v_likes FROM public.event_likes el WHERE el.event_id = p_event_id;
  SELECT COUNT(*) INTO v_comments FROM public.event_comments ec WHERE ec.event_id = p_event_id;
  SELECT COUNT(*) INTO v_favorites FROM public.favorites fav WHERE fav.event_id = p_event_id;
  SELECT COUNT(*) INTO v_checkins FROM public.event_checkins chk WHERE chk.event_id = p_event_id;

  -- Shares non instrumentes pour l'instant.
  v_shares := 0;

  -- Poids basiques:
  -- view=1, like=2, comment=3, favorite=2, checkin=4, share=5
  v_score := v_views + (v_likes * 2) + (v_comments * 3) + (v_favorites * 2) + (v_checkins * 4) + (v_shares * 5);

  INSERT INTO public.event_engagement_stats (
    event_id,
    creator_id,
    views_count,
    likes_count,
    comments_count,
    favorites_count,
    checkins_count,
    shares_count,
    engagement_score,
    updated_at
  )
  VALUES (
    p_event_id,
    v_creator_id,
    v_views,
    v_likes,
    v_comments,
    v_favorites,
    v_checkins,
    v_shares,
    v_score,
    now()
  )
  ON CONFLICT (event_id)
  DO UPDATE SET
    creator_id = EXCLUDED.creator_id,
    views_count = EXCLUDED.views_count,
    likes_count = EXCLUDED.likes_count,
    comments_count = EXCLUDED.comments_count,
    favorites_count = EXCLUDED.favorites_count,
    checkins_count = EXCLUDED.checkins_count,
    shares_count = EXCLUDED.shares_count,
    engagement_score = EXCLUDED.engagement_score,
    updated_at = now();

  PERFORM public.refresh_creator_engagement_stats(v_creator_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_creator_fan(
  p_event_id uuid,
  p_fan_id uuid,
  p_xp_delta integer,
  p_interactions_delta integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id uuid;
BEGIN
  IF p_event_id IS NULL OR p_fan_id IS NULL THEN
    RETURN;
  END IF;

  SELECT e.creator_id
  INTO v_creator_id
  FROM public.events e
  WHERE e.id = p_event_id;

  IF v_creator_id IS NULL OR v_creator_id = p_fan_id THEN
    RETURN;
  END IF;

  INSERT INTO public.creator_fans (
    creator_id,
    fan_id,
    xp,
    level,
    super_fan,
    interactions_count,
    last_interaction_at
  )
  VALUES (
    v_creator_id,
    p_fan_id,
    GREATEST(0, COALESCE(p_xp_delta, 0)),
    1,
    false,
    GREATEST(0, COALESCE(p_interactions_delta, 0)),
    now()
  )
  ON CONFLICT (creator_id, fan_id)
  DO UPDATE SET
    xp = GREATEST(0, public.creator_fans.xp + COALESCE(p_xp_delta, 0)),
    interactions_count = GREATEST(0, public.creator_fans.interactions_count + COALESCE(p_interactions_delta, 0)),
    last_interaction_at = now();

  UPDATE public.creator_fans cf
  SET
    level = GREATEST(1, FLOOR(cf.xp / 100.0)::integer + 1),
    super_fan = (cf.xp >= 500 OR cf.interactions_count >= 25)
  WHERE cf.creator_id = v_creator_id
    AND cf.fan_id = p_fan_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_event_engagement_on_events_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recalculate_event_engagement_stats(NEW.id);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.creator_id IS DISTINCT FROM OLD.creator_id THEN
      PERFORM public.recalculate_event_engagement_stats(NEW.id);
      PERFORM public.refresh_creator_engagement_stats(OLD.creator_id);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_creator_engagement_stats(OLD.creator_id);
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_event_engagement_on_likes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  v_event_id := COALESCE(NEW.event_id, OLD.event_id);
  PERFORM public.recalculate_event_engagement_stats(v_event_id);

  IF TG_OP = 'INSERT' THEN
    PERFORM public.upsert_creator_fan(NEW.event_id, NEW.user_id, 10, 1);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_event_engagement_on_comments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  v_event_id := COALESCE(NEW.event_id, OLD.event_id);
  PERFORM public.recalculate_event_engagement_stats(v_event_id);

  IF TG_OP = 'INSERT' THEN
    PERFORM public.upsert_creator_fan(NEW.event_id, NEW.author_id, 15, 1);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_event_engagement_on_favorites()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  v_event_id := COALESCE(NEW.event_id, OLD.event_id);
  PERFORM public.recalculate_event_engagement_stats(v_event_id);

  IF TG_OP = 'INSERT' THEN
    PERFORM public.upsert_creator_fan(NEW.event_id, NEW.profile_id, 8, 1);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_event_engagement_on_checkins()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalculate_event_engagement_stats(NEW.event_id);
  PERFORM public.upsert_creator_fan(NEW.event_id, NEW.user_id, 20, 1);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_event_engagement_on_views()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalculate_event_engagement_stats(NEW.event_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_event_engagement_on_follows()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id uuid;
BEGIN
  v_creator_id := COALESCE(NEW.following, OLD.following);
  PERFORM public.refresh_creator_engagement_stats(v_creator_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_events_bootstrap_engagement_stats ON public.events;
DROP TRIGGER IF EXISTS trg_events_bootstrap_engagement_stats_insert_update ON public.events;
DROP TRIGGER IF EXISTS trg_events_bootstrap_engagement_stats_delete ON public.events;
CREATE TRIGGER trg_events_bootstrap_engagement_stats_insert_update
AFTER INSERT OR UPDATE OF creator_id ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.handle_event_engagement_on_events_change();

CREATE TRIGGER trg_events_bootstrap_engagement_stats_delete
AFTER DELETE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.handle_event_engagement_on_events_change();

DROP TRIGGER IF EXISTS trg_event_likes_engagement_stats ON public.event_likes;
CREATE TRIGGER trg_event_likes_engagement_stats
AFTER INSERT OR DELETE ON public.event_likes
FOR EACH ROW
EXECUTE FUNCTION public.handle_event_engagement_on_likes();

DROP TRIGGER IF EXISTS trg_event_comments_engagement_stats ON public.event_comments;
CREATE TRIGGER trg_event_comments_engagement_stats
AFTER INSERT OR DELETE ON public.event_comments
FOR EACH ROW
EXECUTE FUNCTION public.handle_event_engagement_on_comments();

DROP TRIGGER IF EXISTS trg_favorites_engagement_stats ON public.favorites;
CREATE TRIGGER trg_favorites_engagement_stats
AFTER INSERT OR DELETE ON public.favorites
FOR EACH ROW
EXECUTE FUNCTION public.handle_event_engagement_on_favorites();

DROP TRIGGER IF EXISTS trg_event_checkins_engagement_stats ON public.event_checkins;
CREATE TRIGGER trg_event_checkins_engagement_stats
AFTER INSERT ON public.event_checkins
FOR EACH ROW
EXECUTE FUNCTION public.handle_event_engagement_on_checkins();

DROP TRIGGER IF EXISTS trg_event_views_engagement_stats ON public.event_views;
CREATE TRIGGER trg_event_views_engagement_stats
AFTER INSERT ON public.event_views
FOR EACH ROW
EXECUTE FUNCTION public.handle_event_engagement_on_views();

DROP TRIGGER IF EXISTS trg_follows_creator_engagement_stats ON public.follows;
CREATE TRIGGER trg_follows_creator_engagement_stats
AFTER INSERT OR DELETE ON public.follows
FOR EACH ROW
EXECUTE FUNCTION public.handle_event_engagement_on_follows();

ALTER TABLE public.event_engagement_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_engagement_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_fans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_engagement_stats_select_authenticated ON public.event_engagement_stats;
CREATE POLICY event_engagement_stats_select_authenticated
  ON public.event_engagement_stats
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS creator_engagement_stats_select_authenticated ON public.creator_engagement_stats;
CREATE POLICY creator_engagement_stats_select_authenticated
  ON public.creator_engagement_stats
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS creator_fans_select_authenticated ON public.creator_fans;
CREATE POLICY creator_fans_select_authenticated
  ON public.creator_fans
  FOR SELECT
  TO authenticated
  USING (true);

DO $$
DECLARE
  v_event_id uuid;
  v_creator_id uuid;
BEGIN
  FOR v_event_id IN
    SELECT e.id
    FROM public.events e
    WHERE e.creator_id IS NOT NULL
  LOOP
    PERFORM public.recalculate_event_engagement_stats(v_event_id);
  END LOOP;

  FOR v_creator_id IN
    SELECT DISTINCT e.creator_id
    FROM public.events e
    WHERE e.creator_id IS NOT NULL
  LOOP
    PERFORM public.refresh_creator_engagement_stats(v_creator_id);
  END LOOP;
END;
$$;

COMMIT;
