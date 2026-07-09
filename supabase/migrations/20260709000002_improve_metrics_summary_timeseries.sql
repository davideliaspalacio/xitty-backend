-- ============================================================================
-- Xitty Backend — richer owner metrics summary and gapless timeseries
-- ============================================================================
-- F5 closes two dashboard gaps:
-- - previous-period comparison per metric, not only total interactions.
-- - day/week buckets with zero counts so charts never have missing dates.
-- ============================================================================

DROP FUNCTION IF EXISTS public.place_metrics_summary(uuid, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.metrics_change_percent(current_value bigint, previous_value bigint)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN previous_value = 0 AND current_value = 0 THEN 0
    WHEN previous_value = 0 THEN 100
    ELSE ROUND(((current_value - previous_value)::numeric / previous_value) * 100, 1)
  END;
$$;

CREATE OR REPLACE FUNCTION public.place_metrics_summary(
  p_place_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE (
  total_views                 bigint,
  total_calls                 bigint,
  total_whatsapp              bigint,
  total_reservations          bigint,
  total_directions            bigint,
  total_promo_views           bigint,
  total_interactions          bigint,
  prev_total_views            bigint,
  prev_total_calls            bigint,
  prev_total_whatsapp         bigint,
  prev_total_reservations     bigint,
  prev_total_directions       bigint,
  prev_total_promo_views      bigint,
  prev_total_interactions     bigint,
  views_change_percent        numeric,
  calls_change_percent        numeric,
  whatsapp_change_percent     numeric,
  reservations_change_percent numeric,
  directions_change_percent   numeric,
  promo_views_change_percent  numeric,
  change_percent              numeric
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
      AND created_at >= prev_from AND created_at < prev_to
  )
  SELECT
    c.views,
    c.calls,
    c.whatsapp,
    c.reservations,
    c.directions,
    c.promo_views,
    c.total,
    p.views,
    p.calls,
    p.whatsapp,
    p.reservations,
    p.directions,
    p.promo_views,
    p.total,
    public.metrics_change_percent(c.views, p.views),
    public.metrics_change_percent(c.calls, p.calls),
    public.metrics_change_percent(c.whatsapp, p.whatsapp),
    public.metrics_change_percent(c.reservations, p.reservations),
    public.metrics_change_percent(c.directions, p.directions),
    public.metrics_change_percent(c.promo_views, p.promo_views),
    public.metrics_change_percent(c.total, p.total)
  FROM current c, previous p;
END;
$$;

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
DECLARE
  step interval;
BEGIN
  IF p_granularity NOT IN ('day', 'week') THEN
    RAISE EXCEPTION 'granularity must be day or week';
  END IF;

  step := CASE WHEN p_granularity = 'week' THEN interval '1 week' ELSE interval '1 day' END;

  RETURN QUERY
  WITH buckets AS (
    SELECT generate_series(
      date_trunc(p_granularity, p_from),
      date_trunc(p_granularity, GREATEST(p_from, p_to - interval '1 second')),
      step
    ) AS bucket
  ),
  activity AS (
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
  )
  SELECT
    b.bucket,
    COALESCE(a.views, 0),
    COALESCE(a.calls, 0),
    COALESCE(a.whatsapp, 0),
    COALESCE(a.reservations, 0),
    COALESCE(a.directions, 0),
    COALESCE(a.promo_views, 0),
    COALESCE(a.total, 0)
  FROM buckets b
  LEFT JOIN activity a ON a.bucket = b.bucket
  ORDER BY b.bucket;
END;
$$;
