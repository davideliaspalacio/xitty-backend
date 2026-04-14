-- ============================================================================
-- M3 — Categories + Places + Place Photos
-- ============================================================================

-- 1) Categories (reference table)
CREATE TABLE IF NOT EXISTS public.categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  slug        text NOT NULL UNIQUE,
  icon        text,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS categories_slug_idx ON public.categories (slug);

-- Seed initial categories for Barranquilla tourism
INSERT INTO public.categories (name, slug, icon, description) VALUES
  ('Restaurantes',           'restaurantes',        'utensils',       'Restaurantes y comida'),
  ('Sitios Turisticos',      'sitios-turisticos',   'landmark',       'Monumentos y sitios de interes'),
  ('Bares y Vida Nocturna',  'bares-vida-nocturna', 'glass-cheers',   'Bares, discotecas y vida nocturna'),
  ('Experiencias',           'experiencias',        'compass',        'Tours y experiencias unicas'),
  ('Hoteles',                'hoteles',             'bed',            'Alojamiento'),
  ('Playas',                 'playas',              'umbrella-beach', 'Playas y balnearios'),
  ('Cultura',                'cultura',             'theater-masks',  'Museos, galerias y centros culturales'),
  ('Compras',                'compras',             'shopping-bag',   'Centros comerciales y tiendas'),
  ('Naturaleza',             'naturaleza',          'tree',           'Parques y reservas naturales'),
  ('Deportes',               'deportes',            'futbol',         'Actividades deportivas y recreativas')
ON CONFLICT (slug) DO NOTHING;

DROP TRIGGER IF EXISTS categories_set_updated_at ON public.categories;
CREATE TRIGGER categories_set_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 2) Places
CREATE TABLE IF NOT EXISTS public.places (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  description     text,
  address         text,
  latitude        double precision,
  longitude       double precision,
  phone           text,
  website         text,
  price_range     smallint CHECK (price_range BETWEEN 1 AND 4),
  schedule        jsonb,
  category_id     uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  owner_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  tags            text[] DEFAULT '{}',
  average_rating  numeric(2,1) NOT NULL DEFAULT 0,
  total_reviews   integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS places_category_id_idx    ON public.places (category_id);
CREATE INDEX IF NOT EXISTS places_owner_id_idx       ON public.places (owner_id);
CREATE INDEX IF NOT EXISTS places_is_active_idx      ON public.places (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS places_average_rating_idx ON public.places (average_rating DESC);
CREATE INDEX IF NOT EXISTS places_price_range_idx    ON public.places (price_range);
CREATE INDEX IF NOT EXISTS places_tags_idx           ON public.places USING GIN (tags);
CREATE INDEX IF NOT EXISTS places_lat_lng_idx        ON public.places (latitude, longitude);

-- Full-text search (Spanish config, weighted) — via trigger (not generated column)
ALTER TABLE public.places ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS places_search_idx ON public.places USING GIN (search_vector);

CREATE OR REPLACE FUNCTION public.places_update_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('spanish', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS places_search_vector_trigger ON public.places;
CREATE TRIGGER places_search_vector_trigger
  BEFORE INSERT OR UPDATE OF name, description, tags ON public.places
  FOR EACH ROW
  EXECUTE FUNCTION public.places_update_search_vector();

-- Haversine distance function (no PostGIS required)
CREATE OR REPLACE FUNCTION public.haversine_distance(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) RETURNS double precision
LANGUAGE sql IMMUTABLE
AS $$
  SELECT 6371000 * acos(
    LEAST(1.0,
      cos(radians(lat1)) * cos(radians(lat2)) *
      cos(radians(lng2) - radians(lng1)) +
      sin(radians(lat1)) * sin(radians(lat2))
    )
  );
$$;

-- RPC for listing places sorted by distance
CREATE OR REPLACE FUNCTION public.list_places_near(
  user_lat double precision,
  user_lng double precision,
  p_category_id uuid DEFAULT NULL,
  p_price_range smallint DEFAULT NULL,
  p_limit integer DEFAULT 10,
  p_offset integer DEFAULT 0
) RETURNS TABLE (
  id uuid, name text, description text, address text,
  latitude double precision, longitude double precision,
  price_range smallint, category_id uuid,
  average_rating numeric, total_reviews integer,
  tags text[], is_active boolean,
  created_at timestamptz, updated_at timestamptz,
  distance_meters double precision
)
LANGUAGE sql STABLE
AS $$
  SELECT
    p.id, p.name, p.description, p.address,
    p.latitude, p.longitude, p.price_range, p.category_id,
    p.average_rating, p.total_reviews,
    p.tags, p.is_active, p.created_at, p.updated_at,
    public.haversine_distance(user_lat, user_lng, p.latitude, p.longitude) AS distance_meters
  FROM public.places p
  WHERE p.is_active = true
    AND p.latitude IS NOT NULL
    AND p.longitude IS NOT NULL
    AND (p_category_id IS NULL OR p.category_id = p_category_id)
    AND (p_price_range IS NULL OR p.price_range = p_price_range)
  ORDER BY distance_meters ASC
  LIMIT p_limit OFFSET p_offset;
$$;

DROP TRIGGER IF EXISTS places_set_updated_at ON public.places;
CREATE TRIGGER places_set_updated_at
  BEFORE UPDATE ON public.places
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 3) Place Photos
CREATE TABLE IF NOT EXISTS public.place_photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id      uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  url           text NOT NULL,
  alt_text      text,
  is_cover      boolean NOT NULL DEFAULT false,
  display_order smallint NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS place_photos_place_id_idx ON public.place_photos (place_id);
CREATE INDEX IF NOT EXISTS place_photos_cover_idx    ON public.place_photos (place_id, is_cover) WHERE is_cover = true;

-- 4) RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_select_all" ON public.categories
  FOR SELECT USING (true);

CREATE POLICY "places_select_active" ON public.places
  FOR SELECT USING (is_active = true);

CREATE POLICY "places_insert_owner" ON public.places
  FOR INSERT WITH CHECK (
    auth.uid() = owner_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "places_update_owner" ON public.places
  FOR UPDATE USING (
    auth.uid() = owner_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "place_photos_select_all" ON public.place_photos
  FOR SELECT USING (true);

CREATE POLICY "place_photos_insert_owner" ON public.place_photos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.places
      WHERE id = place_id AND (
        owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );
