-- ============================================================================
-- PostGIS — enable extension, add geography column to places, sync trigger,
-- GiST index, and faster list_places_near using ST_DWithin.
-- ============================================================================

-- a) Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- b) Add geography column to places
ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS location geography(Point, 4326);

-- c) Populate from existing latitude/longitude (where both are not null)
UPDATE public.places
SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE longitude IS NOT NULL
  AND latitude IS NOT NULL
  AND location IS NULL;

-- d) Trigger to keep location in sync with latitude/longitude on insert/update
CREATE OR REPLACE FUNCTION public.places_sync_location()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS places_sync_location_trigger ON public.places;
CREATE TRIGGER places_sync_location_trigger
  BEFORE INSERT OR UPDATE OF latitude, longitude ON public.places
  FOR EACH ROW
  EXECUTE FUNCTION public.places_sync_location();

-- e) GiST index on location for fast spatial queries
CREATE INDEX IF NOT EXISTS places_location_gix
  ON public.places
  USING GIST (location);

-- f) Rebuild list_places_near using ST_DWithin (uses the GiST index)
CREATE OR REPLACE FUNCTION public.list_places_near(
  user_lat double precision,
  user_lng double precision,
  p_category_id uuid DEFAULT NULL,
  p_price_range smallint DEFAULT NULL,
  p_limit integer DEFAULT 10,
  p_offset integer DEFAULT 0,
  p_max_meters integer DEFAULT 50000
) RETURNS TABLE (
  id uuid,
  name text,
  description text,
  address text,
  latitude double precision,
  longitude double precision,
  price_range smallint,
  category_id uuid,
  average_rating numeric,
  total_reviews integer,
  tags text[],
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  distance_meters double precision
)
LANGUAGE sql STABLE
AS $$
  SELECT
    p.id,
    p.name,
    p.description,
    p.address,
    p.latitude,
    p.longitude,
    p.price_range,
    p.category_id,
    p.average_rating,
    p.total_reviews,
    p.tags,
    p.is_active,
    p.created_at,
    p.updated_at,
    ST_Distance(
      p.location,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    ) AS distance_meters
  FROM public.places p
  WHERE p.is_active = true
    AND p.location IS NOT NULL
    AND ST_DWithin(
      p.location,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      p_max_meters
    )
    AND (p_category_id IS NULL OR p.category_id = p_category_id)
    AND (p_price_range IS NULL OR p.price_range = p_price_range)
  ORDER BY distance_meters ASC
  LIMIT p_limit OFFSET p_offset;
$$;
