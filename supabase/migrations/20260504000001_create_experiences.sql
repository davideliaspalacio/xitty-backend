-- ============================================================================
-- M10 — Experiences (US-040): bookable products with operator, pricing, photos
-- ============================================================================
-- An experience belongs to an "operator" — a place owner (a tour operator,
-- workshop host, etc) who already has a place row. We don't create a separate
-- operators table; we point at places.id and reuse existing ownership.

CREATE TABLE IF NOT EXISTS public.experiences (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_place_id        uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  title                    text NOT NULL,
  slug                     text,
  description              text,
  experience_type          text NOT NULL CHECK (experience_type IN (
    'tour', 'workshop', 'gastronomy', 'adventure',
    'wellness', 'cultural', 'nightlife'
  )),
  tags                     text[] NOT NULL DEFAULT '{}',
  duration_minutes         integer NOT NULL CHECK (duration_minutes > 0),
  price_cop                integer NOT NULL CHECK (price_cop >= 0),
  min_participants         smallint NOT NULL DEFAULT 1 CHECK (min_participants >= 1),
  max_participants         smallint NOT NULL DEFAULT 10 CHECK (max_participants >= min_participants),
  meeting_point_address    text,
  meeting_point_latitude   double precision,
  meeting_point_longitude  double precision,
  cancellation_hours       smallint NOT NULL DEFAULT 24 CHECK (cancellation_hours >= 0),
  average_rating           numeric(2,1) NOT NULL DEFAULT 0,
  total_reviews            integer NOT NULL DEFAULT 0,
  is_active                boolean NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS experiences_operator_idx
  ON public.experiences (operator_place_id);
CREATE INDEX IF NOT EXISTS experiences_type_idx
  ON public.experiences (experience_type) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS experiences_tags_idx
  ON public.experiences USING GIN (tags);
CREATE INDEX IF NOT EXISTS experiences_price_idx
  ON public.experiences (price_cop);
CREATE INDEX IF NOT EXISTS experiences_duration_idx
  ON public.experiences (duration_minutes);

-- ────────────────────────────────────────────────────────────────────────────
-- Slug auto-generation: reuse public.generate_slug() from M5
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.experiences_set_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug text;
  candidate text;
  counter int := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := public.generate_slug(NEW.title);
    candidate := base_slug;
    WHILE EXISTS (
      SELECT 1 FROM public.experiences
      WHERE slug = candidate AND id IS DISTINCT FROM NEW.id
    ) LOOP
      counter := counter + 1;
      candidate := base_slug || '-' || counter;
    END LOOP;
    NEW.slug := candidate;
  ELSE
    NEW.slug := public.generate_slug(NEW.slug);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS experiences_set_slug_trigger ON public.experiences;
CREATE TRIGGER experiences_set_slug_trigger
  BEFORE INSERT OR UPDATE OF title, slug ON public.experiences
  FOR EACH ROW
  EXECUTE FUNCTION public.experiences_set_slug();

ALTER TABLE public.experiences ADD CONSTRAINT experiences_slug_unique UNIQUE (slug);
CREATE INDEX IF NOT EXISTS experiences_slug_idx ON public.experiences (slug);

DROP TRIGGER IF EXISTS experiences_set_updated_at ON public.experiences;
CREATE TRIGGER experiences_set_updated_at
  BEFORE UPDATE ON public.experiences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- Photos (analogous to place_photos)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.experience_photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id uuid NOT NULL REFERENCES public.experiences(id) ON DELETE CASCADE,
  url           text NOT NULL,
  alt_text      text,
  is_cover      boolean NOT NULL DEFAULT false,
  display_order smallint NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS experience_photos_experience_id_idx
  ON public.experience_photos (experience_id);
CREATE INDEX IF NOT EXISTS experience_photos_cover_idx
  ON public.experience_photos (experience_id, is_cover) WHERE is_cover = true;

-- ────────────────────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "experiences_select_active" ON public.experiences
  FOR SELECT USING (is_active = true);

CREATE POLICY "experiences_insert_owner" ON public.experiences
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.places p
      WHERE p.id = operator_place_id AND (
        p.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );

CREATE POLICY "experiences_update_owner" ON public.experiences
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.places p
      WHERE p.id = operator_place_id AND (
        p.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );

CREATE POLICY "experience_photos_select_all" ON public.experience_photos
  FOR SELECT USING (true);

CREATE POLICY "experience_photos_insert_owner" ON public.experience_photos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.experiences e
      JOIN public.places p ON p.id = e.operator_place_id
      WHERE e.id = experience_id AND (
        p.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );
