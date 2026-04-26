-- ============================================================================
-- M5 — Promotions (US-024)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.promotions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id            uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  title               text NOT NULL,
  description         text,
  discount_percentage smallint CHECK (discount_percentage BETWEEN 0 AND 100),
  starts_at           timestamptz NOT NULL,
  ends_at             timestamptz NOT NULL,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promotions_period_valid CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS promotions_place_id_idx ON public.promotions (place_id);
CREATE INDEX IF NOT EXISTS promotions_active_period_idx
  ON public.promotions (place_id, starts_at, ends_at)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS promotions_created_at_idx ON public.promotions (created_at DESC);

DROP TRIGGER IF EXISTS promotions_set_updated_at ON public.promotions;
CREATE TRIGGER promotions_set_updated_at
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- View: only currently-active promotions (is_active AND now() in [starts_at, ends_at])
CREATE OR REPLACE VIEW public.active_promotions AS
SELECT p.*
FROM public.promotions p
WHERE p.is_active = true
  AND now() BETWEEN p.starts_at AND p.ends_at;

-- RLS
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promotions_select_active" ON public.promotions
  FOR SELECT USING (
    is_active = true AND now() BETWEEN starts_at AND ends_at
  );

CREATE POLICY "promotions_select_owner" ON public.promotions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.places
      WHERE id = place_id AND (
        owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );

CREATE POLICY "promotions_insert_owner" ON public.promotions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.places
      WHERE id = place_id AND (
        owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );

CREATE POLICY "promotions_update_owner" ON public.promotions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.places
      WHERE id = place_id AND (
        owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );

CREATE POLICY "promotions_delete_owner" ON public.promotions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.places
      WHERE id = place_id AND (
        owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );
