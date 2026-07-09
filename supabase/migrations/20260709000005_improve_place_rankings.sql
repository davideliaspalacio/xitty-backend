-- ============================================================================
-- F7 — Smarter place rankings: configurable weights + global/category snapshots
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ranking_config (
  id                     text PRIMARY KEY DEFAULT 'default',
  rating_weight          numeric(5,4) NOT NULL DEFAULT 0.45 CHECK (rating_weight >= 0),
  views_weight           numeric(5,4) NOT NULL DEFAULT 0.25 CHECK (views_weight >= 0),
  conversions_weight     numeric(5,4) NOT NULL DEFAULT 0.30 CHECK (conversions_weight >= 0),
  rating_prior           numeric(2,1) NOT NULL DEFAULT 4.2 CHECK (rating_prior BETWEEN 0 AND 5),
  rating_prior_reviews   integer NOT NULL DEFAULT 10 CHECK (rating_prior_reviews >= 0),
  views_cap              integer NOT NULL DEFAULT 500 CHECK (views_cap > 0),
  conversions_cap        integer NOT NULL DEFAULT 100 CHECK (conversions_cap > 0),
  window_days            integer NOT NULL DEFAULT 30 CHECK (window_days BETWEEN 1 AND 365),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ranking_config_weight_total_positive
    CHECK ((rating_weight + views_weight + conversions_weight) > 0)
);

INSERT INTO public.ranking_config (
  id,
  rating_weight,
  views_weight,
  conversions_weight,
  rating_prior,
  rating_prior_reviews,
  views_cap,
  conversions_cap,
  window_days
) VALUES (
  'default',
  0.45,
  0.25,
  0.30,
  4.2,
  10,
  500,
  100,
  30
) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.ranking_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ranking_config_select_all" ON public.ranking_config;
CREATE POLICY "ranking_config_select_all" ON public.ranking_config
  FOR SELECT USING (true);

DROP TRIGGER IF EXISTS ranking_config_set_updated_at ON public.ranking_config;
CREATE TRIGGER ranking_config_set_updated_at
  BEFORE UPDATE ON public.ranking_config
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ranking_snapshots
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'category';

ALTER TABLE public.ranking_snapshots
  DROP CONSTRAINT IF EXISTS ranking_snapshots_scope_check;

ALTER TABLE public.ranking_snapshots
  ADD CONSTRAINT ranking_snapshots_scope_check
  CHECK (scope IN ('global', 'category'));

CREATE INDEX IF NOT EXISTS ranking_snapshots_scope_date_idx
  ON public.ranking_snapshots (scope, snapshot_at DESC, place_id);

CREATE INDEX IF NOT EXISTS ranking_snapshots_scope_category_date_idx
  ON public.ranking_snapshots (scope, category_id, snapshot_at DESC, place_id);

CREATE TABLE IF NOT EXISTS public.ranking_refresh_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status          text NOT NULL CHECK (status IN ('success')),
  started_at      timestamptz NOT NULL,
  finished_at     timestamptz NOT NULL DEFAULT now(),
  rankings_count  integer NOT NULL DEFAULT 0,
  snapshots_count integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ranking_refresh_logs_created_idx
  ON public.ranking_refresh_logs (created_at DESC);

ALTER TABLE public.ranking_refresh_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ranking_refresh_logs_admin_select" ON public.ranking_refresh_logs;
CREATE POLICY "ranking_refresh_logs_admin_select" ON public.ranking_refresh_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

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
  views_30d,
  conversions_30d,
  rating_score,
  views_score,
  conversions_score,
  score,
  RANK() OVER (ORDER BY score DESC, place_id ASC) AS global_position,
  RANK() OVER (PARTITION BY category_id ORDER BY score DESC, place_id ASC) AS category_position,
  RANK() OVER (ORDER BY score DESC, place_id ASC) AS position
FROM scored;

CREATE UNIQUE INDEX IF NOT EXISTS place_rankings_place_id_uidx
  ON public.place_rankings (place_id);

CREATE INDEX IF NOT EXISTS place_rankings_global_position_idx
  ON public.place_rankings (global_position);

CREATE INDEX IF NOT EXISTS place_rankings_category_position_idx
  ON public.place_rankings (category_id, category_position);

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
      category_id,
      place_id,
      position,
      score,
      snapshot_at
    )
    SELECT
      'global',
      NULL,
      place_id,
      global_position,
      score,
      now()
    FROM public.place_rankings
    UNION ALL
    SELECT
      'category',
      category_id,
      place_id,
      category_position,
      score,
      now()
    FROM public.place_rankings
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

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-place-rankings') THEN
      PERFORM cron.unschedule('refresh-place-rankings');
    END IF;

    PERFORM cron.schedule(
      'refresh-place-rankings',
      '0 8 * * *',
      $cron$ SELECT public.refresh_place_rankings(); $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron extension not enabled — schedule the refresh manually after enabling it.';
  END IF;
END
$$;

SELECT public.refresh_place_rankings();
