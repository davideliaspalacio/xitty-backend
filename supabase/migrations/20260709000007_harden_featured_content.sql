-- ============================================================================
-- F9 — Featured content: active-place visibility
-- ============================================================================

CREATE OR REPLACE VIEW public.current_featured AS
SELECT fc.*
FROM public.featured_content fc
JOIN public.places p ON p.id = fc.place_id
WHERE fc.is_active = true
  AND p.is_active = true
  AND now() >= fc.week_starts_at
  AND now() <= fc.week_ends_at
ORDER BY fc.position ASC, fc.created_at DESC;
