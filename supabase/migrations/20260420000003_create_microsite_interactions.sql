-- ============================================================================
-- M5 — Microsite interactions + metrics RPCs (US-023, US-025)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.microsite_interactions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id         uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  user_id          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  interaction_type text NOT NULL CHECK (interaction_type IN (
    'profile_view', 'call_click', 'whatsapp_click',
    'reservation_click', 'directions_click', 'promo_view'
  )),
  promo_id         uuid REFERENCES public.promotions(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS microsite_interactions_place_date_idx
  ON public.microsite_interactions (place_id, created_at DESC);
CREATE INDEX IF NOT EXISTS microsite_interactions_type_idx
  ON public.microsite_interactions (place_id, interaction_type, created_at);

-- RLS
ALTER TABLE public.microsite_interactions ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous) can insert interactions
CREATE POLICY "interactions_insert_all" ON public.microsite_interactions
  FOR INSERT WITH CHECK (true);

-- Only owner of the place or admin can read
CREATE POLICY "interactions_select_owner" ON public.microsite_interactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.places
      WHERE id = place_id AND (
        owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- RPC: Aggregated metrics summary with previous-period comparison
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.place_metrics_summary(
  p_place_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE (
  total_views               bigint,
  total_calls               bigint,
  total_whatsapp            bigint,
  total_reservations        bigint,
  total_directions          bigint,
  total_promo_views         bigint,
  total_interactions        bigint,
  prev_total_interactions   bigint,
  change_percent            numeric
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  prev_from timestamptz;
  prev_to   timestamptz;
  period_length interval;
BEGIN
  period_length := p_to - p_from;
  prev_to   := p_from;
  prev_from := p_from - period_length;

  RETURN QUERY
  WITH current AS (
    SELECT
      COUNT(*) FILTER (WHERE interaction_type = 'profile_view')      AS views,
      COUNT(*) FILTER (WHERE interaction_type = 'call_click')        AS calls,
      COUNT(*) FILTER (WHERE interaction_type = 'whatsapp_click')    AS whatsapp,
      COUNT(*) FILTER (WHERE interaction_type = 'reservation_click') AS reservations,
      COUNT(*) FILTER (WHERE interaction_type = 'directions_click')  AS directions,
      COUNT(*) FILTER (WHERE interaction_type = 'promo_view')        AS promo_views,
      COUNT(*)                                                       AS total
    FROM public.microsite_interactions
    WHERE place_id = p_place_id
      AND created_at >= p_from AND created_at < p_to
  ),
  previous AS (
    SELECT COUNT(*) AS total
    FROM public.microsite_interactions
    WHERE place_id = p_place_id
      AND created_at >= prev_from AND created_at < prev_to
  )
  SELECT
    c.views, c.calls, c.whatsapp, c.reservations, c.directions, c.promo_views, c.total,
    p.total,
    CASE
      WHEN p.total = 0 AND c.total = 0 THEN 0
      WHEN p.total = 0 THEN 100
      ELSE ROUND(((c.total - p.total)::numeric / p.total) * 100, 1)
    END
  FROM current c, previous p;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- RPC: Time series of interactions by day or week
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.place_metrics_timeseries(
  p_place_id    uuid,
  p_from        timestamptz,
  p_to          timestamptz,
  p_granularity text DEFAULT 'day'
)
RETURNS TABLE (
  bucket            timestamptz,
  views             bigint,
  calls             bigint,
  whatsapp          bigint,
  reservations      bigint,
  directions        bigint,
  promo_views       bigint,
  total             bigint
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF p_granularity NOT IN ('day', 'week') THEN
    RAISE EXCEPTION 'granularity must be day or week';
  END IF;

  RETURN QUERY
  SELECT
    date_trunc(p_granularity, created_at) AS bucket,
    COUNT(*) FILTER (WHERE interaction_type = 'profile_view')      AS views,
    COUNT(*) FILTER (WHERE interaction_type = 'call_click')        AS calls,
    COUNT(*) FILTER (WHERE interaction_type = 'whatsapp_click')    AS whatsapp,
    COUNT(*) FILTER (WHERE interaction_type = 'reservation_click') AS reservations,
    COUNT(*) FILTER (WHERE interaction_type = 'directions_click')  AS directions,
    COUNT(*) FILTER (WHERE interaction_type = 'promo_view')        AS promo_views,
    COUNT(*)                                                       AS total
  FROM public.microsite_interactions
  WHERE place_id = p_place_id
    AND created_at >= p_from AND created_at < p_to
  GROUP BY 1
  ORDER BY 1;
END;
$$;
