-- Public (guest) read access for discovery surfaces

-- Events: allow public read of public events
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'events'
      AND policyname = 'events_select_public'
  ) THEN
    DROP POLICY "events_select_public" ON public.events;
  END IF;
  CREATE POLICY "events_select_public"
    ON public.events
    FOR SELECT
    TO anon, authenticated
    USING (visibility = 'public');
END$$;

-- Event media: public read
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_media'
      AND policyname = 'event_media_select_public'
  ) THEN
    DROP POLICY "event_media_select_public" ON public.event_media;
  END IF;
  CREATE POLICY "event_media_select_public"
    ON public.event_media
    FOR SELECT
    TO anon, authenticated
    USING (true);
END$$;

-- Profiles: public read (needed for event creator display)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_select_public'
  ) THEN
    DROP POLICY "profiles_select_public" ON public.profiles;
  END IF;
  CREATE POLICY "profiles_select_public"
    ON public.profiles
    FOR SELECT
    TO anon, authenticated
    USING (true);
END$$;

-- Taxonomy tables: public read
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_category'
      AND policyname = 'event_category_select_public'
  ) THEN
    DROP POLICY "event_category_select_public" ON public.event_category;
  END IF;
  CREATE POLICY "event_category_select_public"
    ON public.event_category
    FOR SELECT
    TO anon, authenticated
    USING (true);
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_subcategory'
      AND policyname = 'event_subcategory_select_public'
  ) THEN
    DROP POLICY "event_subcategory_select_public" ON public.event_subcategory;
  END IF;
  CREATE POLICY "event_subcategory_select_public"
    ON public.event_subcategory
    FOR SELECT
    TO anon, authenticated
    USING (true);
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_tag'
      AND policyname = 'event_tag_select_public'
  ) THEN
    DROP POLICY "event_tag_select_public" ON public.event_tag;
  END IF;
  CREATE POLICY "event_tag_select_public"
    ON public.event_tag
    FOR SELECT
    TO anon, authenticated
    USING (true);
END$$;
