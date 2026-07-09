-- ============================================================================
-- Xitty Backend - city/zone filters for nearby places
-- ============================================================================
-- Complements 20260709000011 by allowing /places?sort_by=distance to honor
-- the same city/zone filters as the normal list query.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.list_places_near(
  user_lat double precision,
  user_lng double precision,
  p_category_id uuid DEFAULT NULL,
  p_price_range smallint DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_zone text DEFAULT NULL,
  p_limit integer DEFAULT 10,
  p_offset integer DEFAULT 0,
  p_max_meters integer DEFAULT 50000
) RETURNS TABLE (
  id uuid,
  name text,
  description text,
  address text,
  city text,
  zone text,
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
    p.city,
    p.zone,
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
    AND (p_city IS NULL OR p.city = p_city)
    AND (p_zone IS NULL OR p.zone = p_zone)
  ORDER BY distance_meters ASC
  LIMIT p_limit OFFSET p_offset;
$$;
