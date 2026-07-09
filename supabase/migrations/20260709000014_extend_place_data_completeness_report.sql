-- ============================================================================
-- Xitty Backend - richer place data completeness report
-- ============================================================================
-- Keeps F1 operations visible after scraper runs: the report now includes city,
-- zone and category breakdown inputs without touching place data.
-- ============================================================================

CREATE OR REPLACE VIEW public.place_data_completeness AS
WITH photo_counts AS (
  SELECT
    place_id,
    COUNT(*)::integer AS photos_count,
    COUNT(*) FILTER (WHERE is_cover)::integer AS cover_photos_count
  FROM public.place_photos
  GROUP BY place_id
),
assessed AS (
  SELECT
    p.id,
    p.name,
    p.city,
    p.zone,
    p.category_id,
    c.name AS category_name,
    c.slug AS category_slug,
    p.source_kind,
    p.source_external_id,
    p.source_url,
    COALESCE(ph.photos_count, 0) AS photos_count,
    COALESCE(ph.cover_photos_count, 0) AS cover_photos_count,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN NULLIF(BTRIM(COALESCE(p.description, '')), '') IS NULL THEN 'description' END,
      CASE WHEN NULLIF(BTRIM(COALESCE(p.address, '')), '') IS NULL THEN 'address' END,
      CASE WHEN p.latitude IS NULL OR p.longitude IS NULL THEN 'coordinates' END,
      CASE WHEN NULLIF(BTRIM(COALESCE(p.phone, p.cta_phone, p.cta_whatsapp, '')), '') IS NULL THEN 'phone_or_whatsapp' END,
      CASE WHEN NULLIF(BTRIM(COALESCE(p.website, '')), '') IS NULL THEN 'website' END,
      CASE WHEN p.schedule IS NULL OR p.schedule = '{}'::jsonb THEN 'schedule' END,
      CASE WHEN p.total_reviews = 0 AND (p.source_reviews IS NULL OR p.source_reviews = '[]'::jsonb) THEN 'reviews' END,
      CASE WHEN COALESCE(ph.photos_count, 0) = 0 THEN 'photos' END,
      CASE WHEN COALESCE(ph.cover_photos_count, 0) = 0 THEN 'cover_photo' END,
      CASE WHEN NULLIF(BTRIM(COALESCE(p.source_url, '')), '') IS NULL THEN 'source_url' END
    ], NULL) AS missing_fields,
    p.created_at,
    p.updated_at
  FROM public.places p
  LEFT JOIN public.categories c ON c.id = p.category_id
  LEFT JOIN photo_counts ph ON ph.place_id = p.id
)
SELECT
  id,
  name,
  city,
  zone,
  category_id,
  category_name,
  category_slug,
  source_kind,
  source_external_id,
  source_url,
  photos_count,
  cover_photos_count,
  missing_fields,
  CARDINALITY(missing_fields) AS missing_count,
  ROUND(((10 - CARDINALITY(missing_fields))::numeric / 10), 2) AS completeness_score,
  created_at,
  updated_at
FROM assessed;

ALTER VIEW public.place_data_completeness SET (security_invoker = true);
