-- ============================================================================
-- Xitty Backend — tabla user_location_snapshots
-- Snapshots de ubicacion del usuario (browser GPS / IP geo / manual).
-- Requiere PostGIS habilitado por 20260603000001_enable_postgis_and_geo.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_location_snapshots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  latitude    double precision NOT NULL,
  longitude   double precision NOT NULL,
  accuracy_m  real,
  source      text NOT NULL DEFAULT 'browser_gps'
              CHECK (source IN ('browser_gps','ip_geo','manual')),
  location    geography(Point, 4326)
              GENERATED ALWAYS AS (
                ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
              ) STORED,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT user_location_snapshots_lat_range
    CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT user_location_snapshots_lng_range
    CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT user_location_snapshots_accuracy_nonneg
    CHECK (accuracy_m IS NULL OR accuracy_m >= 0)
);

-- ----------------------------------------------------------------------------
-- Indices
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS user_location_snapshots_location_gix
  ON public.user_location_snapshots
  USING GIST (location);

CREATE INDEX IF NOT EXISTS user_location_snapshots_user_created_idx
  ON public.user_location_snapshots (user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- Solo el propio usuario puede SELECT/INSERT.
-- Nadie puede DELETE/UPDATE via RLS (limpieza la hace el job de retencion).
-- ----------------------------------------------------------------------------
ALTER TABLE public.user_location_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_location_snapshots_select_own"
  ON public.user_location_snapshots;
CREATE POLICY "user_location_snapshots_select_own"
  ON public.user_location_snapshots FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_location_snapshots_insert_own"
  ON public.user_location_snapshots;
CREATE POLICY "user_location_snapshots_insert_own"
  ON public.user_location_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- (No se definen policies de UPDATE ni DELETE: con RLS habilitada,
--  cualquier intento por roles no-service queda implicitamente denegado.)

-- ----------------------------------------------------------------------------
-- Funcion de retencion: borra snapshots de mas de 7 dias del usuario actual.
-- Pensada para ser invocada por un job de pg_cron (privilegios de servicio)
-- o por el propio usuario, gracias a SECURITY INVOKER.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_old_location_snapshots()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_deleted integer;
BEGIN
  WITH del AS (
    DELETE FROM public.user_location_snapshots
    WHERE created_at < now() - interval '7 days'
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_deleted FROM del;

  RETURN v_deleted;
END;
$$;
