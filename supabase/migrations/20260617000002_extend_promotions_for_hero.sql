-- ============================================================================
-- Extend promotions to support hero ads on the home slot #1.
-- Decision: NO new ad_placements table for MVP. We extend promotions and
-- reuse microsite_interactions with a new interaction_type 'ad_impression'.
-- ============================================================================

-- 1) Hero fields on promotions
ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS is_hero        boolean  NOT NULL DEFAULT false;

ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS hero_priority  smallint NOT NULL DEFAULT 0;

ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS hero_image_url text;

-- Partial index for hot path: fetching the active hero rotation.
CREATE INDEX IF NOT EXISTS promotions_hero_idx
  ON public.promotions (hero_priority DESC, ends_at DESC)
  WHERE is_hero = true AND is_active = true;

-- 2) Extend microsite_interactions check to include 'ad_impression'
ALTER TABLE public.microsite_interactions
  DROP CONSTRAINT IF EXISTS microsite_interactions_interaction_type_check;

ALTER TABLE public.microsite_interactions
  ADD CONSTRAINT microsite_interactions_interaction_type_check
  CHECK (interaction_type IN (
    'profile_view',
    'call_click',
    'whatsapp_click',
    'reservation_click',
    'directions_click',
    'promo_view',
    'ad_impression'
  ));

-- 3) View: currently active hero promotions, ordered by priority desc.
--    Limited to 10 to keep the rotation predictable on the home.
CREATE OR REPLACE VIEW public.active_hero_promotions AS
SELECT p.*
FROM public.promotions p
WHERE p.is_hero = true
  AND p.is_active = true
  AND now() BETWEEN p.starts_at AND p.ends_at
ORDER BY p.hero_priority DESC, p.ends_at DESC
LIMIT 10;
