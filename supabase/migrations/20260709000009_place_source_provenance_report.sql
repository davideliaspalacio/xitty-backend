-- ============================================================================
-- Xitty Backend - place provenance and data completeness report
-- ============================================================================
-- F1 needs reproducible, auditable population. This migration keeps source
-- identity when scraper items become places and exposes a report of missing
-- fields so ops can plan the next data pass without inventing values.
-- ============================================================================

ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS source_kind text,
  ADD COLUMN IF NOT EXISTS source_external_id text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS data_provenance jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.places.source_kind IS
  'Source family that produced the place, e.g. google_places/eventbrite/manual.';
COMMENT ON COLUMN public.places.source_external_id IS
  'Stable external id from the source. Used to keep scraper publication idempotent.';
COMMENT ON COLUMN public.places.source_url IS
  'Canonical public URL from the source when available.';
COMMENT ON COLUMN public.places.data_provenance IS
  'Field-level source notes for imported values. Null values mean not found, never invented.';

CREATE UNIQUE INDEX IF NOT EXISTS places_source_identity_uidx
  ON public.places (source_kind, source_external_id)
  WHERE source_kind IS NOT NULL AND source_external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS places_source_url_uidx
  ON public.places (source_url)
  WHERE source_url IS NOT NULL;

ALTER TABLE public.scraped_items_enriched
  ADD COLUMN IF NOT EXISTS source_kind text,
  ADD COLUMN IF NOT EXISTS source_external_id text;

COMMENT ON COLUMN public.scraped_items_enriched.source_kind IS
  'Copied from scraping source when enriched, so publishing can persist provenance.';
COMMENT ON COLUMN public.scraped_items_enriched.source_external_id IS
  'Copied from raw source item. Used to avoid duplicate place publication.';

CREATE INDEX IF NOT EXISTS scraped_items_enriched_source_identity_idx
  ON public.scraped_items_enriched (source_kind, source_external_id)
  WHERE source_kind IS NOT NULL AND source_external_id IS NOT NULL;

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
  LEFT JOIN photo_counts ph ON ph.place_id = p.id
)
SELECT
  id,
  name,
  source_kind,
  source_external_id,
  source_url,
  photos_count,
  cover_photos_count,
  missing_fields,
  ROUND(((10 - CARDINALITY(missing_fields))::numeric / 10), 2) AS completeness_score,
  created_at,
  updated_at
FROM assessed;

ALTER VIEW public.place_data_completeness SET (security_invoker = true);
