-- ============================================================================
-- M3 — Favorites
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.favorites (
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  place_id   uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, place_id)
);

CREATE INDEX IF NOT EXISTS favorites_user_id_idx  ON public.favorites (user_id);
CREATE INDEX IF NOT EXISTS favorites_place_id_idx ON public.favorites (place_id);

-- RLS
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favorites_select_own" ON public.favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "favorites_insert_own" ON public.favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "favorites_delete_own" ON public.favorites
  FOR DELETE USING (auth.uid() = user_id);
