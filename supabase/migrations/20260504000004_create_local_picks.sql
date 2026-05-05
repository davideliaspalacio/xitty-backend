-- ============================================================================
-- M10 — Local picks (US-042): admin-curated "non-touristy" places
-- ============================================================================
-- Same shape as M7 featured_content but with a fixed taxonomy of pick_tag and
-- a different intent: surfacing the city as a local would, not as a marketed
-- attraction. Kept as a separate table so the UX stays focused.

CREATE TABLE IF NOT EXISTS public.local_picks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id        uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  curator_name    text NOT NULL,
  pick_tag        text NOT NULL CHECK (pick_tag IN ('favorito_local', 'secreto', 'autentico')),
  short_pitch     text,
  hero_image_url  text,
  week_starts_at  timestamptz NOT NULL,
  week_ends_at    timestamptz NOT NULL,
  position        smallint NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT local_picks_week_range_check CHECK (week_ends_at > week_starts_at)
);

CREATE INDEX IF NOT EXISTS local_picks_active_week_idx
  ON public.local_picks (week_starts_at, week_ends_at)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS local_picks_place_id_idx
  ON public.local_picks (place_id);

CREATE INDEX IF NOT EXISTS local_picks_tag_idx
  ON public.local_picks (pick_tag) WHERE is_active = true;

DROP TRIGGER IF EXISTS local_picks_set_updated_at ON public.local_picks;
CREATE TRIGGER local_picks_set_updated_at
  BEFORE UPDATE ON public.local_picks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- View: only currently-active picks (within the week window)
-- ────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.current_local_picks;
CREATE VIEW public.current_local_picks AS
SELECT *
FROM public.local_picks
WHERE is_active = true
  AND now() BETWEEN week_starts_at AND week_ends_at
ORDER BY position ASC, created_at DESC;

-- ────────────────────────────────────────────────────────────────────────────
-- RLS: public read, admin-only writes
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.local_picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "local_picks_select_all" ON public.local_picks
  FOR SELECT USING (true);

CREATE POLICY "local_picks_insert_admin" ON public.local_picks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "local_picks_update_admin" ON public.local_picks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "local_picks_delete_admin" ON public.local_picks
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
