-- ============================================================================
-- Xitty Backend — daily recommendations ("Vale la pena hoy")
-- ============================================================================
-- Motor que combina preferencias del usuario + ubicación + hora actual + ranking
-- base para retornar top N lugares con un campo "reason" (texto en español).
--
-- Algoritmo de scoring:
--   base       = COALESCE(rank.score, p.average_rating/5.0)
--   +0.20      si tags @> ARRAY[user_preferences.traveler_type]
--   +0.10      si price_range <= ceil(budget_max / 100000)
--   +0.10      si schedule jsonb tiene la key del weekday y la hora actual cae
--              en el rango "HH:MM-HH:MM" (formato; "closed" excluye)
--   proximity  si lat/lng dados: ST_DWithin(..., 10000) y -0.0001 * distance_m
--
-- El RPC funciona incluso si user_preferences no existe (fallback: solo ranking
-- base + proximity). El reason se compone de fragmentos legibles.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1) Tabla de recomendaciones diarias persistidas
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_recommendations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  place_id   uuid NOT NULL REFERENCES public.places(id)   ON DELETE CASCADE,
  score      numeric(5,4) NOT NULL,
  reason     text NOT NULL,
  date       date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, place_id, date)
);

CREATE INDEX IF NOT EXISTS daily_recommendations_user_date_idx
  ON public.daily_recommendations (user_id, date DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- 2) Row Level Security — el usuario solo puede leer sus propias recomendaciones
--    El backend Nest usa service_role y bypasea RLS para escribir.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.daily_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_recommendations_select_own" ON public.daily_recommendations;
CREATE POLICY "daily_recommendations_select_own"
  ON public.daily_recommendations FOR SELECT
  USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 3) RPC compute_recommendations_for — corazón del motor
-- ────────────────────────────────────────────────────────────────────────────
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
  -- ── Cargar preferencias del usuario (si existen) ────────────────────────
  -- Si user_preferences no existe o el row no está, las variables quedan NULL
  -- y el algoritmo cae al fallback (ranking + proximity).
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
    -- mapping rough: 100k COP por nivel de price_range
    v_price_cap := CEIL(v_budget_max::numeric / 100000.0);
  END IF;

  -- ── Calcular weekday key (lunes..domingo) y minutos actuales en hora local
  -- Bogotá no tiene DST → fijo en America/Bogota.
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
      -- ── Match traveler_type ────────────────────────────────────────────
      (v_traveler_type IS NOT NULL
        AND c.tags IS NOT NULL
        AND c.tags @> ARRAY[v_traveler_type]
      ) AS match_traveler,
      -- ── Match budget ───────────────────────────────────────────────────
      (v_price_cap IS NOT NULL
        AND c.price_range IS NOT NULL
        AND c.price_range <= v_price_cap
      ) AS match_budget,
      -- ── Está abierto ahora ─────────────────────────────────────────────
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
    -- ── Reason: concatena los fragmentos aplicables ────────────────────────
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

-- ────────────────────────────────────────────────────────────────────────────
-- 4) Permisos — el backend Nest llama via service_role (bypassa RLS y GRANTS).
--    Igual exponemos EXECUTE a authenticated por si en el futuro queremos
--    llamar el RPC directo desde supabase-js.
-- ────────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.compute_recommendations_for(uuid, double precision, double precision, integer)
  TO authenticated, service_role;
