-- ============================================================================
-- FIX — compute_recommendations_for: round(double precision, int) no existe
-- ============================================================================
-- La versión original (20260617000001) aplicaba el cast ::numeric DESPUÉS del
-- ROUND, así que Postgres intentaba resolver round(double precision, integer)
-- — firma inexistente — y GET /recommendations/today devolvía HTTP 400:
--   "function round(double precision, integer) does not exist"
--
-- Los tests unitarios no lo detectaron porque mockean el SupabaseClient y nunca
-- ejecutan el RPC contra Postgres real. Se reprodujo probando producción.
--
-- Fix: castear el argumento a ::numeric ANTES del ROUND. CREATE OR REPLACE
-- reemplaza la función en entornos donde la migración rota ya corrió.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.compute_recommendations_for(
  p_user_id   uuid,
  p_user_lat  double precision DEFAULT NULL,
  p_user_lng  double precision DEFAULT NULL,
  p_limit     integer DEFAULT 10
)
RETURNS TABLE (
  place_id  uuid,
  score     numeric,
  reason    text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_traveler_type text;
  v_budget_max    integer;
  v_price_cap     integer;
  v_weekday_key   text;
  v_now_minutes   integer;
  v_has_location  boolean;
BEGIN
  BEGIN
    SELECT up.traveler_type, up.budget_max
      INTO v_traveler_type, v_budget_max
      FROM public.user_preferences up
     WHERE up.user_id = p_user_id
     LIMIT 1;
  EXCEPTION
    WHEN undefined_table THEN
      v_traveler_type := NULL;
      v_budget_max    := NULL;
  END;

  IF v_budget_max IS NOT NULL THEN
    v_price_cap := CEIL(v_budget_max::numeric / 100000.0);
  END IF;

  v_weekday_key := LOWER(TO_CHAR((now() AT TIME ZONE 'America/Bogota')::date, 'fmday'));
  v_now_minutes := EXTRACT(HOUR FROM (now() AT TIME ZONE 'America/Bogota')) * 60
                 + EXTRACT(MINUTE FROM (now() AT TIME ZONE 'America/Bogota'));

  v_has_location := p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL;

  RETURN QUERY
  WITH candidates AS (
    SELECT
      p.id              AS place_id,
      p.tags,
      p.price_range,
      p.schedule,
      p.average_rating,
      p.location,
      COALESCE(pr.score, p.average_rating / 5.0) AS base_score,
      CASE
        WHEN v_has_location AND p.location IS NOT NULL
          THEN ST_Distance(
                 p.location,
                 ST_SetSRID(ST_MakePoint(p_user_lng, p_user_lat), 4326)::geography
               )
        ELSE NULL
      END AS distance_m
    FROM public.places p
    LEFT JOIN public.place_rankings pr ON pr.place_id = p.id
    WHERE p.is_active = true
      AND (
        NOT v_has_location
        OR p.location IS NULL
        OR ST_DWithin(
             p.location,
             ST_SetSRID(ST_MakePoint(p_user_lng, p_user_lat), 4326)::geography,
             10000
           )
      )
  ),
  scored AS (
    SELECT
      c.place_id,
      c.base_score,
      c.distance_m,
      c.tags,
      c.price_range,
      c.schedule,
      (v_traveler_type IS NOT NULL
        AND c.tags IS NOT NULL
        AND c.tags @> ARRAY[v_traveler_type]
      ) AS match_traveler,
      (v_price_cap IS NOT NULL
        AND c.price_range IS NOT NULL
        AND c.price_range <= v_price_cap
      ) AS match_budget,
      (
        c.schedule IS NOT NULL
        AND c.schedule ? v_weekday_key
        AND (c.schedule ->> v_weekday_key) IS NOT NULL
        AND (c.schedule ->> v_weekday_key) <> 'closed'
        AND (c.schedule ->> v_weekday_key) ~ '^[0-9]{2}:[0-9]{2}-[0-9]{2}:[0-9]{2}$'
        AND v_now_minutes BETWEEN
          (
            (SPLIT_PART(SPLIT_PART(c.schedule ->> v_weekday_key, '-', 1), ':', 1))::int * 60
            + (SPLIT_PART(SPLIT_PART(c.schedule ->> v_weekday_key, '-', 1), ':', 2))::int
          )
          AND
          (
            (SPLIT_PART(SPLIT_PART(c.schedule ->> v_weekday_key, '-', 2), ':', 1))::int * 60
            + (SPLIT_PART(SPLIT_PART(c.schedule ->> v_weekday_key, '-', 2), ':', 2))::int
          )
      ) AS is_open_now
    FROM candidates c
  ),
  final_scored AS (
    SELECT
      s.place_id,
      ROUND(
        LEAST(
          1.0,
          GREATEST(
            0.0,
            s.base_score
            + CASE WHEN s.match_traveler THEN 0.20 ELSE 0 END
            + CASE WHEN s.match_budget   THEN 0.10 ELSE 0 END
            + CASE WHEN s.is_open_now    THEN 0.10 ELSE 0 END
            + CASE WHEN s.distance_m IS NOT NULL THEN -0.0001 * s.distance_m ELSE 0 END
          )
        )::numeric,
        4
      ) AS final_score,
      s.base_score,
      s.distance_m,
      s.match_traveler,
      s.match_budget,
      s.is_open_now
    FROM scored s
  )
  SELECT
    fs.place_id,
    fs.final_score AS score,
    COALESCE(
      NULLIF(
        TRIM(BOTH ' · ' FROM CONCAT_WS(
          ' · ',
          CASE WHEN fs.distance_m IS NOT NULL AND fs.distance_m < 2000 THEN 'Cerca de ti' END,
          CASE WHEN fs.match_traveler THEN 'Para ' || v_traveler_type END,
          CASE WHEN fs.is_open_now    THEN 'Abierto ahora' END,
          CASE WHEN fs.base_score > 0.7 THEN 'Top ranking' END
        )),
        ''
      ),
      'Recomendado para ti'
    ) AS reason
  FROM final_scored fs
  ORDER BY fs.final_score DESC, fs.place_id
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_recommendations_for(uuid, double precision, double precision, integer)
  TO authenticated, service_role;
