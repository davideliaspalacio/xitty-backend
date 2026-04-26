-- ============================================================================
-- M7 — Place rankings (US-030): materialized view + snapshots + nightly cron
-- ============================================================================

-- Pre-requisite (manual in Supabase Dashboard > Database > Extensions):
--   pg_cron must be enabled for the nightly refresh job to work.
--   Without pg_cron, the materialized view stays stale until someone calls
--   SELECT public.refresh_place_rankings() (or hits POST /admin/ranking/refresh).

-- ────────────────────────────────────────────────────────────────────────────
-- 1) Snapshots table — one row per place per refresh, used to compute the
--    position_change delta against the most recent prior snapshot.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ranking_snapshots (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id  uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  place_id     uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  position     integer NOT NULL,
  score        numeric(6,4) NOT NULL,
  snapshot_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ranking_snapshots_category_date_idx
  ON public.ranking_snapshots (category_id, snapshot_at DESC, place_id);

CREATE INDEX IF NOT EXISTS ranking_snapshots_place_date_idx
  ON public.ranking_snapshots (place_id, snapshot_at DESC);

ALTER TABLE public.ranking_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ranking_snapshots_select_all" ON public.ranking_snapshots
  FOR SELECT USING (true);

-- ────────────────────────────────────────────────────────────────────────────
-- 2) Materialized view — computes rank per category from rating, views, and
--    conversions over the last 30 days.
--    Score = 0.4 * normalized_rating + 0.3 * normalized_views + 0.3 * normalized_conversions
-- ────────────────────────────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS public.place_rankings;

CREATE MATERIALIZED VIEW public.place_rankings AS
WITH activity AS (
  SELECT
    place_id,
    COUNT(*) FILTER (WHERE interaction_type = 'profile_view') AS views_30d,
    COUNT(*) FILTER (WHERE interaction_type IN (
      'call_click', 'whatsapp_click', 'reservation_click'
    )) AS conversions_30d
  FROM public.microsite_interactions
  WHERE created_at > now() - interval '30 days'
  GROUP BY place_id
),
scored AS (
  SELECT
    p.id              AS place_id,
    p.category_id,
    COALESCE(a.views_30d, 0)        AS views_30d,
    COALESCE(a.conversions_30d, 0)  AS conversions_30d,
    ROUND(
      (COALESCE(p.average_rating, 0) / 5.0) * 0.4 +
      LEAST(COALESCE(a.views_30d, 0)::numeric / 1000.0, 1.0) * 0.3 +
      LEAST(COALESCE(a.conversions_30d, 0)::numeric / 100.0, 1.0) * 0.3,
      4
    ) AS score
  FROM public.places p
  LEFT JOIN activity a ON a.place_id = p.id
  WHERE p.is_active = true
)
SELECT
  place_id,
  category_id,
  views_30d,
  conversions_30d,
  score,
  RANK() OVER (PARTITION BY category_id ORDER BY score DESC, place_id ASC) AS position
FROM scored;

-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS place_rankings_place_id_uidx
  ON public.place_rankings (place_id);

CREATE INDEX IF NOT EXISTS place_rankings_category_position_idx
  ON public.place_rankings (category_id, position);

CREATE INDEX IF NOT EXISTS place_rankings_score_idx
  ON public.place_rankings (score DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- 3) Refresh function — refreshes the view and writes a snapshot row per place
--    so the next refresh can compute position deltas.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_place_rankings()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.place_rankings;

  INSERT INTO public.ranking_snapshots (category_id, place_id, position, score, snapshot_at)
  SELECT category_id, place_id, position, score, now()
  FROM public.place_rankings;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4) Schedule nightly refresh at 03:00 Bogota time (08:00 UTC).
--    Wrapped in a DO block so the migration does not fail when pg_cron is
--    not yet enabled — the operator can re-run this section after enabling
--    the extension, or call SELECT cron.schedule(...) manually.
-- ────────────────────────────────────────────────────────────────────────────
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

-- Initial population so endpoints have data to serve immediately.
SELECT public.refresh_place_rankings();
