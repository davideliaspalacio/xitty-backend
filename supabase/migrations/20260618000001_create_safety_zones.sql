-- ============================================================================
-- Xitty Backend — safety zones + suggestions_for RPC
-- ============================================================================
-- Sugerencias contextuales para que el frontend pueda mostrar badges como
-- "Zona segura", "Playa a 800m" o "Rango medio".
--
-- Componentes:
--   1) Tabla public.safety_zones con score 0..100 por barrio.
--   2) Seeds para 10 barrios principales de Barranquilla.
--   3) RPC public.suggestions_for(lat, lng) RETURNS jsonb que devuelve el
--      barrio más cercano (vía ST_DWithin con radius_m), la distancia a la
--      playa más cercana y la banda de precio aproximada del área.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1) Tabla safety_zones
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.safety_zones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood  text NOT NULL,
  city          text NOT NULL DEFAULT 'Barranquilla',
  safety_score  smallint NOT NULL CHECK (safety_score BETWEEN 0 AND 100),
  tags          text[] NOT NULL DEFAULT ARRAY[]::text[],
  center_lat    double precision,
  center_lng    double precision,
  radius_m      integer NOT NULL DEFAULT 1000,
  location      geography(Point, 4326) GENERATED ALWAYS AS (
                  ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
                ) STORED,
  notes         text,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- GiST index para queries espaciales rápidas
CREATE INDEX IF NOT EXISTS safety_zones_location_gix
  ON public.safety_zones
  USING GIST (location);

-- Unicidad lógica por (city, neighborhood)
CREATE UNIQUE INDEX IF NOT EXISTS safety_zones_city_neighborhood_uniq
  ON public.safety_zones (city, neighborhood);

-- ────────────────────────────────────────────────────────────────────────────
-- 2) Row Level Security — la seguridad de barrios es información PÚBLICA.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.safety_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "safety_zones_select_public" ON public.safety_zones;
CREATE POLICY "safety_zones_select_public"
  ON public.safety_zones FOR SELECT
  USING (true);

-- ────────────────────────────────────────────────────────────────────────────
-- 3) Seeds — 10 barrios principales de Barranquilla
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.safety_zones
  (neighborhood, city, safety_score, tags, center_lat, center_lng, radius_m)
VALUES
  ('El Prado',           'Barranquilla', 78, ARRAY['turistica','iluminada']::text[],         11.005,  -74.808, 1000),
  ('Alto Prado',         'Barranquilla', 85, ARRAY['residencial','iluminada']::text[],      11.011,  -74.808, 1000),
  ('Riomar',             'Barranquilla', 80, ARRAY['residencial','comercial']::text[],       11.016,  -74.816, 1500),
  ('Villa Country',      'Barranquilla', 82, ARRAY['residencial','comercial']::text[],       11.005,  -74.821, 1200),
  ('El Recreo',          'Barranquilla', 65, ARRAY['residencial']::text[],                   10.989,  -74.812, 1000),
  ('Boston',             'Barranquilla', 60, ARRAY['residencial','transito']::text[],        10.998,  -74.811, 1000),
  ('Centro Histórico',   'Barranquilla', 50, ARRAY['turistica','dia']::text[],               10.969,  -74.797, 1500),
  ('Las Flores',         'Barranquilla', 55, ARRAY['gastronomia','dia']::text[],             11.018,  -74.842, 1500),
  ('La Concepción',      'Barranquilla', 72, ARRAY['bohemia','nocturna']::text[],            11.005,  -74.811,  800),
  ('Bocas de Ceniza',    'Barranquilla', 45, ARRAY['naturaleza','dia','no_solo']::text[],    11.040,  -74.850, 2000)
ON CONFLICT (city, neighborhood) DO UPDATE
SET safety_score = EXCLUDED.safety_score,
    tags         = EXCLUDED.tags,
    center_lat   = EXCLUDED.center_lat,
    center_lng   = EXCLUDED.center_lng,
    radius_m     = EXCLUDED.radius_m,
    updated_at   = now();

-- ────────────────────────────────────────────────────────────────────────────
-- 4) RPC suggestions_for(lat, lng) RETURNS jsonb
--    Devuelve:
--      {
--        "safety_zone": { neighborhood, score, tags, tone } | null,
--        "nearby_beach_m": numeric | null,
--        "price_band": "asequible" | "medio" | "premium" | null
--      }
--
--    tone:
--      score >= 70  → "good"
--      score >= 50  → "ok"
--      score <  50  → "caution"
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.suggestions_for(
  p_lat double precision,
  p_lng double precision
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_point         geography;
  v_safety_zone   jsonb := NULL;
  v_beach_m       double precision := NULL;
  v_price_band    text := NULL;
  v_avg_price     numeric;
  v_zone_record   record;
BEGIN
  v_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;

  -- ── safety_zone más cercana dentro de su propio radius_m ────────────────
  SELECT sz.neighborhood, sz.safety_score, sz.tags,
         ST_Distance(sz.location, v_point) AS dist
    INTO v_zone_record
    FROM public.safety_zones sz
   WHERE sz.location IS NOT NULL
     AND ST_DWithin(sz.location, v_point, sz.radius_m)
   ORDER BY ST_Distance(sz.location, v_point) ASC
   LIMIT 1;

  IF FOUND THEN
    v_safety_zone := jsonb_build_object(
      'neighborhood', v_zone_record.neighborhood,
      'score',        v_zone_record.safety_score,
      'tags',         to_jsonb(COALESCE(v_zone_record.tags, ARRAY[]::text[])),
      'tone',
        CASE
          WHEN v_zone_record.safety_score >= 70 THEN 'good'
          WHEN v_zone_record.safety_score >= 50 THEN 'ok'
          ELSE 'caution'
        END
    );
  END IF;

  -- ── playa más cercana ──────────────────────────────────────────────────
  -- Heurística: places con tag 'playa' o categoría slug 'playa'.
  -- Si la categoría no existe (ej. en tests), el bloque cae con silencio.
  BEGIN
    SELECT MIN(ST_Distance(p.location, v_point))::double precision
      INTO v_beach_m
      FROM public.places p
     WHERE p.is_active = true
       AND p.location IS NOT NULL
       AND (
         (p.tags IS NOT NULL AND p.tags @> ARRAY['playa']::text[])
         OR EXISTS (
           SELECT 1 FROM public.categories c
            WHERE c.id = p.category_id
              AND c.slug = 'playa'
         )
       )
       AND ST_DWithin(p.location, v_point, 5000);
  EXCEPTION
    WHEN undefined_table THEN
      v_beach_m := NULL;
    WHEN undefined_column THEN
      v_beach_m := NULL;
  END;

  IF v_beach_m IS NOT NULL THEN
    v_beach_m := ROUND(v_beach_m::numeric, 0)::double precision;
  END IF;

  -- ── banda de precio del área (promedio price_range de places <2km) ─────
  BEGIN
    SELECT AVG(p.price_range)::numeric
      INTO v_avg_price
      FROM public.places p
     WHERE p.is_active = true
       AND p.location IS NOT NULL
       AND p.price_range IS NOT NULL
       AND ST_DWithin(p.location, v_point, 2000);
  EXCEPTION
    WHEN undefined_table THEN
      v_avg_price := NULL;
    WHEN undefined_column THEN
      v_avg_price := NULL;
  END;

  IF v_avg_price IS NOT NULL THEN
    v_price_band := CASE
      WHEN v_avg_price <  1.7 THEN 'asequible'
      WHEN v_avg_price <  2.7 THEN 'medio'
      ELSE                          'premium'
    END;
  END IF;

  RETURN jsonb_build_object(
    'safety_zone',    v_safety_zone,
    'nearby_beach_m', v_beach_m,
    'price_band',     v_price_band
  );
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 5) Permisos — el backend usa service_role. El RPC se expone también a
--    anon/authenticated porque la información del badge es pública.
-- ────────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.suggestions_for(double precision, double precision)
  TO anon, authenticated, service_role;
