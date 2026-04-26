-- ============================================================================
-- M7 — Featured content (US-032): admin-curated weekly highlights
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.featured_content (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id            uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  curator_name        text NOT NULL,
  custom_title        text,
  custom_description  text,
  hero_image_url      text,
  week_starts_at      timestamptz NOT NULL,
  week_ends_at        timestamptz NOT NULL,
  position            smallint NOT NULL DEFAULT 0,
  is_active           boolean NOT NULL DEFAULT true,
  created_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT featured_content_week_range_check CHECK (week_ends_at > week_starts_at)
);

CREATE INDEX IF NOT EXISTS featured_content_active_week_idx
  ON public.featured_content (week_starts_at, week_ends_at)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS featured_content_place_id_idx
  ON public.featured_content (place_id);

DROP TRIGGER IF EXISTS featured_content_set_updated_at ON public.featured_content;
CREATE TRIGGER featured_content_set_updated_at
  BEFORE UPDATE ON public.featured_content
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- View: only currently-active features (within the week window)
-- ────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.current_featured;
CREATE VIEW public.current_featured AS
SELECT *
FROM public.featured_content
WHERE is_active = true
  AND now() BETWEEN week_starts_at AND week_ends_at
ORDER BY position ASC, created_at DESC;

-- ────────────────────────────────────────────────────────────────────────────
-- RLS: public read, admin-only writes
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.featured_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "featured_content_select_all" ON public.featured_content
  FOR SELECT USING (true);

CREATE POLICY "featured_content_insert_admin" ON public.featured_content
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "featured_content_update_admin" ON public.featured_content
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "featured_content_delete_admin" ON public.featured_content
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
