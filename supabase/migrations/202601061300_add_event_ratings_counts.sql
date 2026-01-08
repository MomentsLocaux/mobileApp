-- Add ratings and counters for events
ALTER TABLE public.event_comments
ADD COLUMN IF NOT EXISTS rating smallint CHECK (rating BETWEEN 1 AND 5);

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS comments_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS media_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS rating_avg numeric(3,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.update_event_comment_stats()
RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.events
    SET
      comments_count = comments_count + 1,
      rating_count = rating_count + CASE WHEN NEW.rating IS NOT NULL THEN 1 ELSE 0 END,
      rating_avg = CASE
        WHEN NEW.rating IS NULL THEN rating_avg
        WHEN rating_count = 0 THEN NEW.rating
        ELSE ROUND(((rating_avg * rating_count) + NEW.rating)::numeric / (rating_count + 1), 2)
      END
    WHERE id = NEW.event_id;
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.rating IS DISTINCT FROM NEW.rating) THEN
      UPDATE public.events
      SET rating_count = (
          SELECT COUNT(*)
          FROM public.event_comments
          WHERE event_id = NEW.event_id AND rating IS NOT NULL
        ),
        rating_avg = COALESCE(
          (SELECT ROUND(AVG(rating)::numeric, 2) FROM public.event_comments WHERE event_id = NEW.event_id AND rating IS NOT NULL),
          0
        )
      WHERE id = NEW.event_id;
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.events
    SET
      comments_count = GREATEST(comments_count - 1, 0),
      rating_count = (
        SELECT COUNT(*)
        FROM public.event_comments
        WHERE event_id = OLD.event_id AND rating IS NOT NULL
      ),
      rating_avg = COALESCE(
        (SELECT ROUND(AVG(rating)::numeric, 2) FROM public.event_comments WHERE event_id = OLD.event_id AND rating IS NOT NULL),
        0
      )
    WHERE id = OLD.event_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_event_comments_stats ON public.event_comments;
CREATE TRIGGER trg_event_comments_stats
AFTER INSERT OR UPDATE OR DELETE ON public.event_comments
FOR EACH ROW EXECUTE FUNCTION public.update_event_comment_stats();

CREATE OR REPLACE FUNCTION public.update_event_media_count()
RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.events
    SET media_count = media_count + 1
    WHERE id = NEW.event_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.events
    SET media_count = GREATEST(media_count - 1, 0)
    WHERE id = OLD.event_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_event_media_count ON public.event_media;
CREATE TRIGGER trg_event_media_count
AFTER INSERT OR DELETE ON public.event_media
FOR EACH ROW EXECUTE FUNCTION public.update_event_media_count();

-- Backfill counts
WITH comment_stats AS (
  SELECT event_id,
         COUNT(*) cnt,
         COUNT(rating) ratings,
         ROUND(AVG(rating)::numeric, 2) avg
  FROM public.event_comments
  GROUP BY event_id
),
media_stats AS (
  SELECT event_id, COUNT(*) cnt
  FROM public.event_media
  GROUP BY event_id
)
UPDATE public.events e
SET
  comments_count = COALESCE(c.cnt, 0),
  rating_count = COALESCE(c.ratings, 0),
  rating_avg = COALESCE(c.avg, 0),
  media_count = COALESCE(m.cnt, 0)
FROM comment_stats c
FULL JOIN media_stats m
  ON m.event_id = c.event_id
WHERE e.id = COALESCE(c.event_id, m.event_id);
