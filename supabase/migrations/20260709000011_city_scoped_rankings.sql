-- ============================================================================
-- Xitty Backend - city-scoped places and rankings
-- ============================================================================
-- F7 explicitly requires rankings by city (Cartagena and Barranquilla).
-- This migration stores city/zone on imported places and extends the ranking
-- materialized view + snapshots with city and city/category positions.
-- ============================================================================

ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS zone text;

ALTER TABLE public.scraped_items_enriched
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS zone text;

COMMENT ON COLUMN public.places.city IS
  'Operational city scope for discovery/ranking, e.g. Cartagena or Barranquilla.';
COMMENT ON COLUMN public.places.zone IS
  'Operational neighborhood/zone inside the city, used for data QA and planning.';
COMMENT ON COLUMN public.scraped_items_enriched.city IS
  'Copied from scraping_sources.config.city when available.';
COMMENT ON COLUMN public.scraped_items_enriched.zone IS
  'Copied from scraping_sources.config.zone when available.';

UPDATE public.places
SET city = 'Cartagena'
WHERE city IS NULL
  AND (
    address ILIKE '%Cartagena%'
    OR source_url ILIKE '%cartagena%'
    OR data_provenance::text ILIKE '%Cartagena%'
  );

UPDATE public.places
SET city = 'Barranquilla'
WHERE city IS NULL
  AND (
    address ILIKE '%Barranquilla%'
    OR source_url ILIKE '%barranquilla%'
    OR data_provenance::text ILIKE '%Barranquilla%'
  );

CREATE INDEX IF NOT EXISTS places_city_active_idx
  ON public.places (city, is_active)
  WHERE city IS NOT NULL;

CREATE INDEX IF NOT EXISTS places_city_category_active_idx
  ON public.places (city, category_id, is_active)
  WHERE city IS NOT NULL;

CREATE INDEX IF NOT EXISTS scraped_items_enriched_city_status_idx
  ON public.scraped_items_enriched (city, status)
  WHERE city IS NOT NULL;

ALTER TABLE public.ranking_snapshots
  ADD COLUMN IF NOT EXISTS city text;

ALTER TABLE public.ranking_snapshots
  DROP CONSTRAINT IF EXISTS ranking_snapshots_scope_check;

ALTER TABLE public.ranking_snapshots
  ADD CONSTRAINT ranking_snapshots_scope_check
  CHECK (scope IN ('global', 'category', 'city', 'city_category'));

CREATE INDEX IF NOT EXISTS ranking_snapshots_scope_city_date_idx
  ON public.ranking_snapshots (scope, city, snapshot_at DESC, place_id);

CREATE INDEX IF NOT EXISTS ranking_snapshots_scope_city_category_date_idx
  ON public.ranking_snapshots (scope, city, category_id, snapshot_at DESC, place_id);

DROP MATERIALIZED VIEW IF EXISTS public.place_rankings;

CREATE MATERIALIZED VIEW public.place_rankings AS
WITH config AS (
  SELECT *
  FROM public.ranking_config
  WHERE id = 'default'
),
activity AS (
  SELECT
    mi.place_id,
    COUNT(*) FILTER (WHERE mi.interaction_type = 'profile_view') AS views_30d,
    COUNT(*) FILTER (WHERE mi.interaction_type IN (
      'call_click',
      'whatsapp_click',
      'reservation_click',
      'directions_click'
    )) AS conversions_30d
  FROM public.microsite_interactions mi
  CROSS JOIN config c
  WHERE mi.created_at >= now() - make_interval(days => c.window_days)
  GROUP BY mi.place_id
),
components AS (
  SELECT
    p.id AS place_id,
    p.category_id,
    NULLIF(BTRIM(p.city), '') AS city,
    NULLIF(BTRIM(p.zone), '') AS zone,
    COALESCE(a.views_30d, 0) AS views_30d,
    COALESCE(a.conversions_30d, 0) AS conversions_30d,
    COALESCE(
      (
        (
          (COALESCE(p.average_rating, 0)::numeric * COALESCE(p.total_reviews, 0))
          + (c.rating_prior * c.rating_prior_reviews)
        )
        / NULLIF(COALESCE(p.total_reviews, 0) + c.rating_prior_reviews, 0)
      ) / 5.0,
      c.rating_prior / 5.0
    ) AS rating_score,
    LEAST(
      LN(COALESCE(a.views_30d, 0)::numeric + 1)
      / NULLIF(LN(c.views_cap::numeric + 1), 0),
      1.0
    ) AS views_score,
    LEAST(
      LN(COALESCE(a.conversions_30d, 0)::numeric + 1)
      / NULLIF(LN(c.conversions_cap::numeric + 1), 0),
      1.0
    ) AS conversions_score,
    (c.rating_weight + c.views_weight + c.conversions_weight) AS total_weight,
    c.rating_weight,
    c.views_weight,
    c.conversions_weight
  FROM public.places p
  CROSS JOIN config c
  LEFT JOIN activity a ON a.place_id = p.id
  WHERE p.is_active = true
),
scored AS (
  SELECT
    place_id,
    category_id,
    city,
    zone,
    views_30d,
    conversions_30d,
    ROUND(rating_score, 4) AS rating_score,
    ROUND(views_score, 4) AS views_score,
    ROUND(conversions_score, 4) AS conversions_score,
    ROUND(
      (
        rating_score * rating_weight
        + views_score * views_weight
        + conversions_score * conversions_weight
      ) / NULLIF(total_weight, 0),
      4
    ) AS score
  FROM components
)
SELECT
  place_id,
  category_id,
  city,
  zone,
  views_30d,
  conversions_30d,
  rating_score,
  views_score,
  conversions_score,
  score,
  RANK() OVER (ORDER BY score DESC, place_id ASC) AS global_position,
  RANK() OVER (PARTITION BY category_id ORDER BY score DESC, place_id ASC) AS category_position,
  RANK() OVER (PARTITION BY city ORDER BY score DESC, place_id ASC) AS city_position,
  RANK() OVER (PARTITION BY city, category_id ORDER BY score DESC, place_id ASC) AS city_category_position,
  RANK() OVER (ORDER BY score DESC, place_id ASC) AS position
FROM scored;

CREATE UNIQUE INDEX IF NOT EXISTS place_rankings_place_id_uidx
  ON public.place_rankings (place_id);

CREATE INDEX IF NOT EXISTS place_rankings_global_position_idx
  ON public.place_rankings (global_position);

CREATE INDEX IF NOT EXISTS place_rankings_category_position_idx
  ON public.place_rankings (category_id, category_position);

CREATE INDEX IF NOT EXISTS place_rankings_city_position_idx
  ON public.place_rankings (city, city_position)
  WHERE city IS NOT NULL;

CREATE INDEX IF NOT EXISTS place_rankings_city_category_position_idx
  ON public.place_rankings (city, category_id, city_category_position)
  WHERE city IS NOT NULL;

CREATE INDEX IF NOT EXISTS place_rankings_score_idx
  ON public.place_rankings (score DESC);

CREATE OR REPLACE FUNCTION public.refresh_place_rankings()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_started_at timestamptz := clock_timestamp();
  v_rankings_count integer := 0;
  v_snapshots_count integer := 0;
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.place_rankings;

  SELECT COUNT(*) INTO v_rankings_count
  FROM public.place_rankings;

  WITH inserted AS (
    INSERT INTO public.ranking_snapshots (
      scope,
      city,
      category_id,
      place_id,
      position,
      score,
      snapshot_at
    )
    SELECT
      'global',
      NULL,
      NULL,
      place_id,
      global_position,
      score,
      now()
    FROM public.place_rankings
    UNION ALL
    SELECT
      'category',
      NULL,
      category_id,
      place_id,
      category_position,
      score,
      now()
    FROM public.place_rankings
    UNION ALL
    SELECT
      'city',
      city,
      NULL,
      place_id,
      city_position,
      score,
      now()
    FROM public.place_rankings
    WHERE city IS NOT NULL
    UNION ALL
    SELECT
      'city_category',
      city,
      category_id,
      place_id,
      city_category_position,
      score,
      now()
    FROM public.place_rankings
    WHERE city IS NOT NULL
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_snapshots_count
  FROM inserted;

  INSERT INTO public.ranking_refresh_logs (
    status,
    started_at,
    finished_at,
    rankings_count,
    snapshots_count
  ) VALUES (
    'success',
    v_started_at,
    clock_timestamp(),
    v_rankings_count,
    v_snapshots_count
  );
END;
$$;

SELECT public.refresh_place_rankings();
