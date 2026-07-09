-- ============================================================================
-- F3 — Promotions public visibility and Colombia timezone semantics
-- ============================================================================
-- Date-only inputs are normalized by the API as full calendar days in
-- America/Bogota. Public SQL visibility must also avoid leaking promotions for
-- inactive places.

CREATE OR REPLACE VIEW public.active_promotions AS
SELECT p.*
FROM public.promotions p
JOIN public.places pl ON pl.id = p.place_id
WHERE p.is_active = true
  AND pl.is_active = true
  AND now() >= p.starts_at
  AND now() <= p.ends_at;

CREATE OR REPLACE VIEW public.active_hero_promotions AS
SELECT p.*
FROM public.promotions p
JOIN public.places pl ON pl.id = p.place_id
WHERE p.is_hero = true
  AND p.is_active = true
  AND pl.is_active = true
  AND now() >= p.starts_at
  AND now() <= p.ends_at
ORDER BY p.hero_priority DESC, p.ends_at DESC
LIMIT 10;

DROP POLICY IF EXISTS "promotions_select_active" ON public.promotions;
CREATE POLICY "promotions_select_active" ON public.promotions
  FOR SELECT USING (
    is_active = true
    AND now() >= starts_at
    AND now() <= ends_at
    AND EXISTS (
      SELECT 1
      FROM public.places
      WHERE places.id = place_id
        AND places.is_active = true
    )
  );
