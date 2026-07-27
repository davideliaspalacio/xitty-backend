-- ============================================================================
-- BUNDLE DE MIGRACIONES — TRABAJO DE MEJORAS (julio 2026)
-- ============================================================================
-- Consolidado de las 21 migraciones del scraper overhaul + features v2 +
-- auditoría, en ORDEN de aplicación (por timestamp del nombre de archivo).
--
-- ⚠️ CÓMO APLICAR (leer antes de pegar):
--   • Forma SEGURA (recomendada): desde la raíz del repo,  `supabase db push`
--     — aplica SOLO las migraciones pendientes, en orden. No re-corre las ya
--     aplicadas. Es lo que deberías usar si prod ya tiene algunas.
--   • Este bundle es para: (a) una base NUEVA/limpia, o (b) referencia/copiar
--     una migración puntual. Si lo pegás ENTERO sobre un prod que ya tiene
--     algunas aplicadas, las partes idempotentes (CREATE ... IF NOT EXISTS,
--     ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE) pasan sin problema, pero
--     los INSERT de seed (fuentes Cartagena) y algún CREATE POLICY pueden
--     fallar o duplicar. En ese caso, aplicá solo las pendientes.
--
--   • Tras la migración de city (…000011), corré el catch-all para que el
--     directorio /places no salga vacío:
--       UPDATE public.places SET city = 'Barranquilla' WHERE city IS NULL;
-- ============================================================================



-- ############################################################################
-- ARCHIVO: 20260701000001_scraper_images_reviews_storage.sql
-- ############################################################################
-- Xitty — Scraper: soporte de imágenes re-hospedadas + señal de reseñas.
--
-- Contexto: el fetch del scraper es determinista (Google Places / Eventbrite)
-- y trae foto, rating y nº de reseñas. La IA NO inventa imágenes; solo
-- normaliza texto y juzga si el item es real. Las fotos de la fuente se
-- re-hospedan en Storage (bucket propio) para no exponer la API key de la
-- fuente en URLs públicas.

-- 1) Señal de reseñas en el item enriquecido (la usa el quality-scorer y el
--    juicio de "¿es real?"). image_url ya existe en la tabla.
ALTER TABLE public.scraped_items_enriched
  ADD COLUMN IF NOT EXISTS rating       numeric(2, 1),
  ADD COLUMN IF NOT EXISTS review_count integer;

COMMENT ON COLUMN public.scraped_items_enriched.rating IS
  'Rating 0..5 de la fuente (Google Places userRating). Determinista, no de la IA.';
COMMENT ON COLUMN public.scraped_items_enriched.review_count IS
  'Cantidad de reseñas de la fuente. Señal de "lugar real y activo".';

-- 2) Bucket público para las fotos scrapeadas re-hospedadas.
--    Guardamos una copia propia (URL estable) en vez de la URL de Google, que
--    lleva la API key y/o expira.
INSERT INTO storage.buckets (id, name, public)
VALUES ('scraped-photos', 'scraped-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Lectura pública del bucket. La escritura la hace el backend con la
-- service-role key (que bypassa RLS), así que no necesitamos policy de insert.
DROP POLICY IF EXISTS "scraped_photos_public_read" ON storage.objects;
CREATE POLICY "scraped_photos_public_read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'scraped-photos');


-- ############################################################################
-- ARCHIVO: 20260701000002_seed_cartagena_sources.sql
-- ############################################################################
-- Xitty — Seed de fuentes de scraping para CARTAGENA.
--
-- Arrancamos la cobertura en los 3 focos turísticos: Centro Histórico +
-- Getsemaní (un solo centro cubre ambos), Bocagrande, y una red amplia sobre
-- toda la ciudad. Segmentamos por tipo: restaurant / tourist_attraction /
-- event_venue (Google Places) + eventos (Eventbrite).
--
-- Idempotente: `name` es UNIQUE, así que ON CONFLICT no duplica al re-correr.
-- `enabled=true` para que aparezcan en el panel admin listas para "Run".
-- Corren en mock hasta setear GOOGLE_MAPS_API_KEY / EVENTBRITE_API_KEY.

INSERT INTO public.scraping_sources (name, kind, config, enabled)
VALUES
  -- ── Centro Histórico + Getsemaní (radio 1.8km cubre ambos) ──────────────
  ('Cartagena · Centro Histórico — Restaurantes', 'google_places',
   '{"lat":10.4220,"lng":-75.5490,"radius_m":1800,"type":"restaurant","max_results":20}'::jsonb, true),
  ('Cartagena · Centro Histórico — Atracciones', 'google_places',
   '{"lat":10.4220,"lng":-75.5490,"radius_m":1800,"type":"tourist_attraction","max_results":20}'::jsonb, true),
  ('Cartagena · Centro Histórico — Eventos/venues', 'google_places',
   '{"lat":10.4220,"lng":-75.5490,"radius_m":1800,"type":"event_venue","max_results":20}'::jsonb, true),

  -- ── Bocagrande (radio 1.5km) ────────────────────────────────────────────
  ('Cartagena · Bocagrande — Restaurantes', 'google_places',
   '{"lat":10.3990,"lng":-75.5545,"radius_m":1500,"type":"restaurant","max_results":20}'::jsonb, true),
  ('Cartagena · Bocagrande — Atracciones', 'google_places',
   '{"lat":10.3990,"lng":-75.5545,"radius_m":1500,"type":"tourist_attraction","max_results":20}'::jsonb, true),

  -- ── Red amplia sobre toda Cartagena (radio 12km) ────────────────────────
  ('Cartagena · Ciudad (amplio) — Restaurantes', 'google_places',
   '{"lat":10.4100,"lng":-75.5300,"radius_m":12000,"type":"restaurant","max_results":20}'::jsonb, true),
  ('Cartagena · Ciudad (amplio) — Atracciones', 'google_places',
   '{"lat":10.4100,"lng":-75.5300,"radius_m":12000,"type":"tourist_attraction","max_results":20}'::jsonb, true),

  -- ── Eventos (Eventbrite) ────────────────────────────────────────────────
  ('Cartagena · Eventos', 'eventbrite',
   '{"location_address":"Cartagena, Colombia","location_within_km":20,"max_results":20}'::jsonb, true)
ON CONFLICT (name) DO NOTHING;


-- ############################################################################
-- ARCHIVO: 20260701000003_scraper_rich_place_fields.sql
-- ############################################################################
-- Xitty — Scraper: perfil COMPLETO del negocio en la cola de moderación.
--
-- El fetch de Google Places (New) trae, además de foto/rating/reseñas:
-- teléfono, sitio web, horarios y nivel de precio. Los guardamos en el item
-- enriquecido para poder mapearlos al `place` al publicar (todos deterministas
-- de la fuente, NO inventados por la IA).

ALTER TABLE public.scraped_items_enriched
  ADD COLUMN IF NOT EXISTS phone         text,
  ADD COLUMN IF NOT EXISTS website       text,
  ADD COLUMN IF NOT EXISTS opening_hours jsonb,
  ADD COLUMN IF NOT EXISTS price_level   smallint;

COMMENT ON COLUMN public.scraped_items_enriched.phone IS
  'Teléfono nacional de la fuente (Google nationalPhoneNumber).';
COMMENT ON COLUMN public.scraped_items_enriched.website IS
  'Sitio web oficial del negocio (Google websiteUri).';
COMMENT ON COLUMN public.scraped_items_enriched.opening_hours IS
  'Horarios legibles: { "weekday_descriptions": ["Lunes: 9–18", ...] }.';
COMMENT ON COLUMN public.scraped_items_enriched.price_level IS
  'Nivel de precio 1..4 (mapea el enum de Google a price_range del place).';


-- ############################################################################
-- ARCHIVO: 20260702000001_scraper_source_reviews.sql
-- ############################################################################
-- Xitty — Scraper: opiniones/reseñas reales de la fuente (Google).
--
-- Guardamos las reseñas que trae Google (autor, estrellas, texto, fecha) para
-- mostrarlas en el detalle como "Reseñas de Google" — atribuidas a la fuente y
-- separadas de las reseñas que escriben los usuarios de Xitty.
--
-- Forma del jsonb (array):
--   [{ "author": "...", "rating": 5, "text": "...",
--      "relative_time": "hace 2 meses", "publish_time": "2026-..." }, ...]

ALTER TABLE public.scraped_items_enriched
  ADD COLUMN IF NOT EXISTS source_reviews jsonb;

ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS source_reviews jsonb;

COMMENT ON COLUMN public.places.source_reviews IS
  'Reseñas importadas de la fuente (Google). Display-only, con atribución.';


-- ############################################################################
-- ARCHIVO: 20260706000001_create_audio_tours.sql
-- ############################################################################
-- ============================================================================
-- Xitty Backend — Audio tours for places and microsites
-- ============================================================================
-- MVP:
-- - Public users can read active tours and ordered stops.
-- - Authenticated users can save progress.
-- - The model supports multiple languages per place.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audio_tours (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id               uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  title                  text NOT NULL,
  description            text,
  language_code          text NOT NULL DEFAULT 'es',
  narrator_name          text,
  estimated_duration_min integer NOT NULL DEFAULT 0 CHECK (estimated_duration_min >= 0),
  cover_image_url        text,
  is_active              boolean NOT NULL DEFAULT false,
  created_by             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audio_tours_language_code_check
    CHECK (language_code ~ '^[a-z]{2}(-[A-Z]{2})?$')
);

CREATE INDEX IF NOT EXISTS audio_tours_place_active_idx
  ON public.audio_tours (place_id, is_active, language_code);

CREATE UNIQUE INDEX IF NOT EXISTS audio_tours_one_active_lang_per_place_idx
  ON public.audio_tours (place_id, language_code)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS audio_tours_set_updated_at ON public.audio_tours;
CREATE TRIGGER audio_tours_set_updated_at
  BEFORE UPDATE ON public.audio_tours
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.audio_tour_stops (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audio_tour_id     uuid NOT NULL REFERENCES public.audio_tours(id) ON DELETE CASCADE,
  title             text NOT NULL,
  description       text,
  audio_url         text,
  transcript        text,
  language_code     text NOT NULL DEFAULT 'es',
  duration_seconds  integer NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  display_order     integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  latitude          double precision CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude         double precision CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  radius_m          integer CHECK (radius_m IS NULL OR radius_m > 0),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audio_tour_stops_language_code_check
    CHECK (language_code ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  UNIQUE (audio_tour_id, display_order)
);

CREATE INDEX IF NOT EXISTS audio_tour_stops_tour_order_idx
  ON public.audio_tour_stops (audio_tour_id, display_order);

DROP TRIGGER IF EXISTS audio_tour_stops_set_updated_at ON public.audio_tour_stops;
CREATE TRIGGER audio_tour_stops_set_updated_at
  BEFORE UPDATE ON public.audio_tour_stops
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.audio_tour_progress (
  user_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  audio_tour_id         uuid NOT NULL REFERENCES public.audio_tours(id) ON DELETE CASCADE,
  current_stop_id       uuid REFERENCES public.audio_tour_stops(id) ON DELETE SET NULL,
  completed_stop_ids    uuid[] NOT NULL DEFAULT '{}',
  last_position_seconds integer NOT NULL DEFAULT 0 CHECK (last_position_seconds >= 0),
  completed_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, audio_tour_id)
);

CREATE INDEX IF NOT EXISTS audio_tour_progress_user_updated_idx
  ON public.audio_tour_progress (user_id, updated_at DESC);

DROP TRIGGER IF EXISTS audio_tour_progress_set_updated_at ON public.audio_tour_progress;
CREATE TRIGGER audio_tour_progress_set_updated_at
  BEFORE UPDATE ON public.audio_tour_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.audio_tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_tour_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_tour_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audio_tours_select_active" ON public.audio_tours;
CREATE POLICY "audio_tours_select_active"
  ON public.audio_tours FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "audio_tour_stops_select_active_tour" ON public.audio_tour_stops;
CREATE POLICY "audio_tour_stops_select_active_tour"
  ON public.audio_tour_stops FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.audio_tours t
      WHERE t.id = audio_tour_stops.audio_tour_id
        AND t.is_active = true
    )
  );

DROP POLICY IF EXISTS "audio_tour_progress_select_own" ON public.audio_tour_progress;
CREATE POLICY "audio_tour_progress_select_own"
  ON public.audio_tour_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "audio_tour_progress_insert_own" ON public.audio_tour_progress;
CREATE POLICY "audio_tour_progress_insert_own"
  ON public.audio_tour_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "audio_tour_progress_update_own" ON public.audio_tour_progress;
CREATE POLICY "audio_tour_progress_update_own"
  ON public.audio_tour_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Pilot content for local/dev seed data. If the place does not exist, this is
-- a no-op. Real production audio assets can later replace the transcript-only
-- stops by setting audio_url.
DO $$
DECLARE
  v_place_id uuid;
  v_tour_id uuid;
BEGIN
  SELECT id
    INTO v_place_id
    FROM public.places
   WHERE name = 'Castillo de Salgar'
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_place_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id
    INTO v_tour_id
    FROM public.audio_tours
   WHERE place_id = v_place_id
     AND language_code = 'es'
   LIMIT 1;

  IF v_tour_id IS NOT NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.audio_tours (
    place_id,
    title,
    description,
    language_code,
    narrator_name,
    estimated_duration_min,
    is_active
  )
  VALUES (
    v_place_id,
    'Recorrido historico del Castillo de Salgar',
    'Una guia breve para entender por que esta fortaleza mira al Caribe y al antiguo puerto.',
    'es',
    'Xitty',
    7,
    true
  )
  RETURNING id INTO v_tour_id;

  INSERT INTO public.audio_tour_stops (
    audio_tour_id,
    title,
    description,
    transcript,
    language_code,
    duration_seconds,
    display_order,
    latitude,
    longitude,
    radius_m
  )
  VALUES
    (
      v_tour_id,
      'La llegada frente al mar',
      'Empieza el recorrido mirando hacia el Caribe.',
      'Estas frente a una fortaleza construida para vigilar una costa estrategica. Antes de ser un lugar para fotos y eventos, este punto ayudaba a entender el movimiento del puerto, la entrada al rio Magdalena y la relacion de Barranquilla con el Caribe.',
      'es',
      95,
      0,
      10.9889,
      -74.9633,
      80
    ),
    (
      v_tour_id,
      'El valor historico',
      'Una parada para conectar arquitectura, comercio y defensa.',
      'El Castillo de Salgar representa una epoca en la que el comercio, la navegacion y la defensa costera estaban profundamente conectados. Su presencia recuerda que el crecimiento de Barranquilla no se entiende sin el rio, el mar y las rutas que movian personas, ideas y mercancias.',
      'es',
      120,
      1,
      10.9889,
      -74.9633,
      80
    ),
    (
      v_tour_id,
      'Atardecer y memoria',
      'Cierra el recorrido desde el punto mas fotografiado.',
      'Cuando cae la tarde, el castillo cambia de tono y se vuelve mirador. Es un buen momento para observar como el patrimonio tambien puede sentirse vivo: no solo como una fecha antigua, sino como una forma de mirar la ciudad desde su borde costero.',
      'es',
      110,
      2,
      10.9889,
      -74.9633,
      80
    );
END $$;


-- ############################################################################
-- ARCHIVO: 20260709000001_harden_microsite_interactions.sql
-- ############################################################################
-- ============================================================================
-- Xitty Backend — harden microsite interactions against accidental inflation
-- ============================================================================
-- Adds anonymous-session hashing and app-level dedup metadata. The backend
-- stores no raw session id, no IP address and no raw user-agent.
-- ============================================================================

ALTER TABLE public.microsite_interactions
  ADD COLUMN IF NOT EXISTS anonymous_session_hash text,
  ADD COLUMN IF NOT EXISTS user_agent_hash text,
  ADD COLUMN IF NOT EXISTS dedup_key text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.microsite_interactions.anonymous_session_hash IS
  'SHA-256 hash of the frontend anonymous session id. Raw id is never stored.';
COMMENT ON COLUMN public.microsite_interactions.user_agent_hash IS
  'SHA-256 hash of the request user-agent for aggregate debugging without storing raw UA.';
COMMENT ON COLUMN public.microsite_interactions.dedup_key IS
  'App-computed key for best-effort dedup by place/event/promo/actor/time bucket.';
COMMENT ON COLUMN public.microsite_interactions.metadata IS
  'Reserved structured metadata for tracking source/version; must not contain PII.';

CREATE UNIQUE INDEX IF NOT EXISTS microsite_interactions_dedup_key_uidx
  ON public.microsite_interactions (dedup_key)
  WHERE dedup_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS microsite_interactions_actor_date_idx
  ON public.microsite_interactions (place_id, anonymous_session_hash, created_at DESC)
  WHERE anonymous_session_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS microsite_interactions_place_type_date_idx
  ON public.microsite_interactions (place_id, interaction_type, created_at DESC);

-- Keep old environments compatible with hero ad impressions.
ALTER TABLE public.microsite_interactions
  DROP CONSTRAINT IF EXISTS microsite_interactions_interaction_type_check;

ALTER TABLE public.microsite_interactions
  ADD CONSTRAINT microsite_interactions_interaction_type_check
  CHECK (interaction_type IN (
    'profile_view',
    'call_click',
    'whatsapp_click',
    'reservation_click',
    'directions_click',
    'promo_view',
    'ad_impression'
  ));


-- ############################################################################
-- ARCHIVO: 20260709000002_improve_metrics_summary_timeseries.sql
-- ############################################################################
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


-- ############################################################################
-- ARCHIVO: 20260709000003_harden_place_slugs.sql
-- ############################################################################
-- ============================================================================
-- Xitty Backend — harden public place slugs for top-level microsites
-- ============================================================================
-- Supports URLs like /la-trattoria while protecting app-owned paths.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_reserved_place_slug(candidate text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(candidate) = ANY (ARRAY[
    'admin',
    'api',
    'audio-tours',
    'curated',
    'dashboard',
    'experiences',
    'favorites',
    'forgot-password',
    'home',
    'login',
    'microsites',
    'onboarding',
    'places',
    'profile',
    'promotions',
    'register',
    'reservations',
    'reset-password',
    'verify-email',
    'www'
  ]);
$$;

CREATE OR REPLACE FUNCTION public.places_set_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug text;
  candidate text;
  counter int := 0;
BEGIN
  base_slug := public.generate_slug(COALESCE(NULLIF(NEW.slug, ''), NEW.name));

  IF base_slug IS NULL OR base_slug = '' THEN
    base_slug := 'lugar';
  END IF;

  candidate := base_slug;

  WHILE public.is_reserved_place_slug(candidate)
    OR EXISTS (
      SELECT 1 FROM public.places
      WHERE slug = candidate AND id IS DISTINCT FROM NEW.id
    )
  LOOP
    counter := counter + 1;
    candidate := base_slug || '-' || counter;
  END LOOP;

  NEW.slug := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS places_set_slug_trigger ON public.places;
CREATE TRIGGER places_set_slug_trigger
  BEFORE INSERT OR UPDATE OF name, slug ON public.places
  FOR EACH ROW
  EXECUTE FUNCTION public.places_set_slug();

-- Repair rows that would collide with app routes or empty generated slugs.
UPDATE public.places
SET slug = NULL
WHERE slug IS NULL
  OR slug = ''
  OR public.is_reserved_place_slug(slug);


-- ############################################################################
-- ARCHIVO: 20260709000004_harden_promotions_public_visibility.sql
-- ############################################################################
-- ============================================================================
-- F3 — Promotions public visibility and Colombia timezone semantics
-- ============================================================================
-- Date-only inputs are normalized by the API as full calendar days in
-- America/Bogota. Public SQL visibility must also avoid leaking promotions for
-- inactive places.

CREATE OR REPLACE VIEW public.active_promotions AS
SELECT p.*
FROM public.promotions p
JOIN public.places pl ON pl.id = p.place_id
WHERE p.is_active = true
  AND pl.is_active = true
  AND now() >= p.starts_at
  AND now() <= p.ends_at;

CREATE OR REPLACE VIEW public.active_hero_promotions AS
SELECT p.*
FROM public.promotions p
JOIN public.places pl ON pl.id = p.place_id
WHERE p.is_hero = true
  AND p.is_active = true
  AND pl.is_active = true
  AND now() >= p.starts_at
  AND now() <= p.ends_at
ORDER BY p.hero_priority DESC, p.ends_at DESC
LIMIT 10;

DROP POLICY IF EXISTS "promotions_select_active" ON public.promotions;
CREATE POLICY "promotions_select_active" ON public.promotions
  FOR SELECT USING (
    is_active = true
    AND now() >= starts_at
    AND now() <= ends_at
    AND EXISTS (
      SELECT 1
      FROM public.places
      WHERE places.id = place_id
        AND places.is_active = true
    )
  );


-- ############################################################################
-- ARCHIVO: 20260709000005_improve_place_rankings.sql
-- ############################################################################
-- ============================================================================
-- F7 — Smarter place rankings: configurable weights + global/category snapshots
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ranking_config (
  id                     text PRIMARY KEY DEFAULT 'default',
  rating_weight          numeric(5,4) NOT NULL DEFAULT 0.45 CHECK (rating_weight >= 0),
  views_weight           numeric(5,4) NOT NULL DEFAULT 0.25 CHECK (views_weight >= 0),
  conversions_weight     numeric(5,4) NOT NULL DEFAULT 0.30 CHECK (conversions_weight >= 0),
  rating_prior           numeric(2,1) NOT NULL DEFAULT 4.2 CHECK (rating_prior BETWEEN 0 AND 5),
  rating_prior_reviews   integer NOT NULL DEFAULT 10 CHECK (rating_prior_reviews >= 0),
  views_cap              integer NOT NULL DEFAULT 500 CHECK (views_cap > 0),
  conversions_cap        integer NOT NULL DEFAULT 100 CHECK (conversions_cap > 0),
  window_days            integer NOT NULL DEFAULT 30 CHECK (window_days BETWEEN 1 AND 365),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ranking_config_weight_total_positive
    CHECK ((rating_weight + views_weight + conversions_weight) > 0)
);

INSERT INTO public.ranking_config (
  id,
  rating_weight,
  views_weight,
  conversions_weight,
  rating_prior,
  rating_prior_reviews,
  views_cap,
  conversions_cap,
  window_days
) VALUES (
  'default',
  0.45,
  0.25,
  0.30,
  4.2,
  10,
  500,
  100,
  30
) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.ranking_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ranking_config_select_all" ON public.ranking_config;
CREATE POLICY "ranking_config_select_all" ON public.ranking_config
  FOR SELECT USING (true);

DROP TRIGGER IF EXISTS ranking_config_set_updated_at ON public.ranking_config;
CREATE TRIGGER ranking_config_set_updated_at
  BEFORE UPDATE ON public.ranking_config
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ranking_snapshots
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'category';

ALTER TABLE public.ranking_snapshots
  DROP CONSTRAINT IF EXISTS ranking_snapshots_scope_check;

ALTER TABLE public.ranking_snapshots
  ADD CONSTRAINT ranking_snapshots_scope_check
  CHECK (scope IN ('global', 'category'));

CREATE INDEX IF NOT EXISTS ranking_snapshots_scope_date_idx
  ON public.ranking_snapshots (scope, snapshot_at DESC, place_id);

CREATE INDEX IF NOT EXISTS ranking_snapshots_scope_category_date_idx
  ON public.ranking_snapshots (scope, category_id, snapshot_at DESC, place_id);

CREATE TABLE IF NOT EXISTS public.ranking_refresh_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status          text NOT NULL CHECK (status IN ('success')),
  started_at      timestamptz NOT NULL,
  finished_at     timestamptz NOT NULL DEFAULT now(),
  rankings_count  integer NOT NULL DEFAULT 0,
  snapshots_count integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ranking_refresh_logs_created_idx
  ON public.ranking_refresh_logs (created_at DESC);

ALTER TABLE public.ranking_refresh_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ranking_refresh_logs_admin_select" ON public.ranking_refresh_logs;
CREATE POLICY "ranking_refresh_logs_admin_select" ON public.ranking_refresh_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP MATERIALIZED VIEW IF EXISTS public.place_rankings;

CREATE MATERIALIZED VIEW public.place_rankings AS
WITH config AS (
  SELECT *
  FROM public.ranking_config
  WHERE id = 'default'
),
activity AS (
  SELECT
    mi.place_id,
    COUNT(*) FILTER (WHERE mi.interaction_type = 'profile_view') AS views_30d,
    COUNT(*) FILTER (WHERE mi.interaction_type IN (
      'call_click',
      'whatsapp_click',
      'reservation_click',
      'directions_click'
    )) AS conversions_30d
  FROM public.microsite_interactions mi
  CROSS JOIN config c
  WHERE mi.created_at >= now() - make_interval(days => c.window_days)
  GROUP BY mi.place_id
),
components AS (
  SELECT
    p.id AS place_id,
    p.category_id,
    COALESCE(a.views_30d, 0) AS views_30d,
    COALESCE(a.conversions_30d, 0) AS conversions_30d,
    COALESCE(
      (
        (
          (COALESCE(p.average_rating, 0)::numeric * COALESCE(p.total_reviews, 0))
          + (c.rating_prior * c.rating_prior_reviews)
        )
        / NULLIF(COALESCE(p.total_reviews, 0) + c.rating_prior_reviews, 0)
      ) / 5.0,
      c.rating_prior / 5.0
    ) AS rating_score,
    LEAST(
      LN(COALESCE(a.views_30d, 0)::numeric + 1)
      / NULLIF(LN(c.views_cap::numeric + 1), 0),
      1.0
    ) AS views_score,
    LEAST(
      LN(COALESCE(a.conversions_30d, 0)::numeric + 1)
      / NULLIF(LN(c.conversions_cap::numeric + 1), 0),
      1.0
    ) AS conversions_score,
    (c.rating_weight + c.views_weight + c.conversions_weight) AS total_weight,
    c.rating_weight,
    c.views_weight,
    c.conversions_weight
  FROM public.places p
  CROSS JOIN config c
  LEFT JOIN activity a ON a.place_id = p.id
  WHERE p.is_active = true
),
scored AS (
  SELECT
    place_id,
    category_id,
    views_30d,
    conversions_30d,
    ROUND(rating_score, 4) AS rating_score,
    ROUND(views_score, 4) AS views_score,
    ROUND(conversions_score, 4) AS conversions_score,
    ROUND(
      (
        rating_score * rating_weight
        + views_score * views_weight
        + conversions_score * conversions_weight
      ) / NULLIF(total_weight, 0),
      4
    ) AS score
  FROM components
)
SELECT
  place_id,
  category_id,
  views_30d,
  conversions_30d,
  rating_score,
  views_score,
  conversions_score,
  score,
  RANK() OVER (ORDER BY score DESC, place_id ASC) AS global_position,
  RANK() OVER (PARTITION BY category_id ORDER BY score DESC, place_id ASC) AS category_position,
  RANK() OVER (ORDER BY score DESC, place_id ASC) AS position
FROM scored;

CREATE UNIQUE INDEX IF NOT EXISTS place_rankings_place_id_uidx
  ON public.place_rankings (place_id);

CREATE INDEX IF NOT EXISTS place_rankings_global_position_idx
  ON public.place_rankings (global_position);

CREATE INDEX IF NOT EXISTS place_rankings_category_position_idx
  ON public.place_rankings (category_id, category_position);

CREATE INDEX IF NOT EXISTS place_rankings_score_idx
  ON public.place_rankings (score DESC);

CREATE OR REPLACE FUNCTION public.refresh_place_rankings()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_started_at timestamptz := clock_timestamp();
  v_rankings_count integer := 0;
  v_snapshots_count integer := 0;
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.place_rankings;

  SELECT COUNT(*) INTO v_rankings_count
  FROM public.place_rankings;

  WITH inserted AS (
    INSERT INTO public.ranking_snapshots (
      scope,
      category_id,
      place_id,
      position,
      score,
      snapshot_at
    )
    SELECT
      'global',
      NULL,
      place_id,
      global_position,
      score,
      now()
    FROM public.place_rankings
    UNION ALL
    SELECT
      'category',
      category_id,
      place_id,
      category_position,
      score,
      now()
    FROM public.place_rankings
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_snapshots_count
  FROM inserted;

  INSERT INTO public.ranking_refresh_logs (
    status,
    started_at,
    finished_at,
    rankings_count,
    snapshots_count
  ) VALUES (
    'success',
    v_started_at,
    clock_timestamp(),
    v_rankings_count,
    v_snapshots_count
  );
END;
$$;

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

SELECT public.refresh_place_rankings();


-- ############################################################################
-- ARCHIVO: 20260709000006_harden_sponsored_placements.sql
-- ############################################################################
-- ============================================================================
-- F8 — Sponsored placements: priority slots + automatic expiry cleanup
-- ============================================================================

ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS sponsorship_priority smallint NOT NULL DEFAULT 0;

ALTER TABLE public.places
  DROP CONSTRAINT IF EXISTS places_sponsorship_priority_check;

ALTER TABLE public.places
  ADD CONSTRAINT places_sponsorship_priority_check
  CHECK (sponsorship_priority BETWEEN 0 AND 100);

CREATE INDEX IF NOT EXISTS places_active_sponsorship_priority_idx
  ON public.places (sponsorship_priority DESC, sponsored_until DESC)
  WHERE is_sponsored = true;

CREATE OR REPLACE FUNCTION public.expire_sponsorships()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE public.places
  SET
    is_sponsored = false,
    sponsorship_priority = 0,
    updated_at = now()
  WHERE is_sponsored = true
    AND sponsored_until IS NOT NULL
    AND sponsored_until <= now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-sponsorships-hourly') THEN
      PERFORM cron.unschedule('expire-sponsorships-hourly');
    END IF;

    PERFORM cron.schedule(
      'expire-sponsorships-hourly',
      '0 * * * *',
      $cron$ SELECT public.expire_sponsorships(); $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron extension not enabled — sponsorships still expire at read time; run SELECT public.expire_sponsorships() manually if needed.';
  END IF;
END
$$;

SELECT public.expire_sponsorships();


-- ############################################################################
-- ARCHIVO: 20260709000007_harden_featured_content.sql
-- ############################################################################
-- ============================================================================
-- F9 — Featured content: active-place visibility
-- ============================================================================

CREATE OR REPLACE VIEW public.current_featured AS
SELECT fc.*
FROM public.featured_content fc
JOIN public.places p ON p.id = fc.place_id
WHERE fc.is_active = true
  AND p.is_active = true
  AND now() >= fc.week_starts_at
  AND now() <= fc.week_ends_at
ORDER BY fc.position ASC, fc.created_at DESC;


-- ############################################################################
-- ARCHIVO: 20260709000008_create_notification_outbox.sql
-- ############################################################################
-- ============================================================================
-- Xitty Backend - notification outbox for business preferences
-- ============================================================================
-- F6 closes the gap between saved notification preferences and actual event
-- handling. Delivery channel/provider remains pending, so this migration stores
-- notifications in an internal outbox that a later worker can deliver.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.business_notification_outbox (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  place_id           uuid REFERENCES public.places(id) ON DELETE CASCADE,
  interaction_id     uuid REFERENCES public.microsite_interactions(id) ON DELETE SET NULL,
  notification_type  text NOT NULL CHECK (notification_type IN (
    'call_click',
    'whatsapp_click',
    'reservation_click',
    'daily_summary'
  )),
  channel            text NOT NULL DEFAULT 'pending' CHECK (channel IN (
    'pending',
    'email',
    'push',
    'whatsapp'
  )),
  status             text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'sent',
    'failed',
    'skipped'
  )),
  dedup_key          text,
  payload            jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for      timestamptz NOT NULL DEFAULT now(),
  sent_at            timestamptz,
  error_message      text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.business_notification_outbox IS
  'Internal queue of business notifications. Delivery provider/channel is configured later.';
COMMENT ON COLUMN public.business_notification_outbox.channel IS
  'pending means the app captured intent but no delivery provider has been selected yet.';
COMMENT ON COLUMN public.business_notification_outbox.dedup_key IS
  'Stable key to keep retries from duplicating notifications.';

CREATE INDEX IF NOT EXISTS business_notification_outbox_recipient_status_idx
  ON public.business_notification_outbox (recipient_user_id, status, scheduled_for DESC);

CREATE INDEX IF NOT EXISTS business_notification_outbox_place_created_idx
  ON public.business_notification_outbox (place_id, created_at DESC)
  WHERE place_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS business_notification_outbox_dedup_key_uidx
  ON public.business_notification_outbox (dedup_key)
  WHERE dedup_key IS NOT NULL;

DROP TRIGGER IF EXISTS business_notification_outbox_set_updated_at
  ON public.business_notification_outbox;
CREATE TRIGGER business_notification_outbox_set_updated_at
  BEFORE UPDATE ON public.business_notification_outbox
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.business_notification_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_outbox_select_owner" ON public.business_notification_outbox;
CREATE POLICY "notification_outbox_select_owner"
  ON public.business_notification_outbox
  FOR SELECT
  USING (
    recipient_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "notification_outbox_update_admin" ON public.business_notification_outbox;
CREATE POLICY "notification_outbox_update_admin"
  ON public.business_notification_outbox
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION public.enqueue_daily_business_summaries(
  p_for_date date DEFAULT ((now() AT TIME ZONE 'America/Bogota')::date - 1)
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from timestamptz := (p_for_date::timestamp AT TIME ZONE 'America/Bogota');
  v_to   timestamptz := ((p_for_date + 1)::timestamp AT TIME ZONE 'America/Bogota');
  v_inserted integer := 0;
BEGIN
  INSERT INTO public.business_notification_outbox (
    recipient_user_id,
    place_id,
    notification_type,
    channel,
    status,
    dedup_key,
    payload,
    scheduled_for
  )
  SELECT
    p.owner_id,
    mi.place_id,
    'daily_summary',
    'pending',
    'pending',
    format('daily_summary:%s:%s:%s', p.owner_id, mi.place_id, p_for_date),
    jsonb_build_object(
      'date', p_for_date::text,
      'place_id', mi.place_id,
      'profile_views', COUNT(*) FILTER (WHERE mi.interaction_type = 'profile_view'),
      'call_clicks', COUNT(*) FILTER (WHERE mi.interaction_type = 'call_click'),
      'whatsapp_clicks', COUNT(*) FILTER (WHERE mi.interaction_type = 'whatsapp_click'),
      'reservation_clicks', COUNT(*) FILTER (WHERE mi.interaction_type = 'reservation_click'),
      'directions_clicks', COUNT(*) FILTER (WHERE mi.interaction_type = 'directions_click'),
      'promo_views', COUNT(*) FILTER (WHERE mi.interaction_type = 'promo_view'),
      'total_interactions', COUNT(*)
    ),
    now()
  FROM public.microsite_interactions mi
  JOIN public.places p
    ON p.id = mi.place_id
   AND p.owner_id IS NOT NULL
   AND COALESCE(p.is_active, true) = true
  LEFT JOIN public.business_notification_settings settings
    ON settings.user_id = p.owner_id
  WHERE mi.created_at >= v_from
    AND mi.created_at < v_to
    AND COALESCE(settings.daily_summary, true) = true
  GROUP BY p.owner_id, mi.place_id
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM cron.job
      WHERE jobname = 'enqueue-daily-business-summaries'
    ) THEN
      PERFORM cron.unschedule('enqueue-daily-business-summaries');
    END IF;

    PERFORM cron.schedule(
      'enqueue-daily-business-summaries',
      '0 12 * * *',
      $cron$SELECT public.enqueue_daily_business_summaries();$cron$
    );
  END IF;
END $$;


-- ############################################################################
-- ARCHIVO: 20260709000009_place_source_provenance_report.sql
-- ############################################################################
-- ============================================================================
-- Xitty Backend - place provenance and data completeness report
-- ============================================================================
-- F1 needs reproducible, auditable population. This migration keeps source
-- identity when scraper items become places and exposes a report of missing
-- fields so ops can plan the next data pass without inventing values.
-- ============================================================================

ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS source_kind text,
  ADD COLUMN IF NOT EXISTS source_external_id text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS data_provenance jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.places.source_kind IS
  'Source family that produced the place, e.g. google_places/eventbrite/manual.';
COMMENT ON COLUMN public.places.source_external_id IS
  'Stable external id from the source. Used to keep scraper publication idempotent.';
COMMENT ON COLUMN public.places.source_url IS
  'Canonical public URL from the source when available.';
COMMENT ON COLUMN public.places.data_provenance IS
  'Field-level source notes for imported values. Null values mean not found, never invented.';

CREATE UNIQUE INDEX IF NOT EXISTS places_source_identity_uidx
  ON public.places (source_kind, source_external_id)
  WHERE source_kind IS NOT NULL AND source_external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS places_source_url_uidx
  ON public.places (source_url)
  WHERE source_url IS NOT NULL;

ALTER TABLE public.scraped_items_enriched
  ADD COLUMN IF NOT EXISTS source_kind text,
  ADD COLUMN IF NOT EXISTS source_external_id text;

COMMENT ON COLUMN public.scraped_items_enriched.source_kind IS
  'Copied from scraping source when enriched, so publishing can persist provenance.';
COMMENT ON COLUMN public.scraped_items_enriched.source_external_id IS
  'Copied from raw source item. Used to avoid duplicate place publication.';

CREATE INDEX IF NOT EXISTS scraped_items_enriched_source_identity_idx
  ON public.scraped_items_enriched (source_kind, source_external_id)
  WHERE source_kind IS NOT NULL AND source_external_id IS NOT NULL;

CREATE OR REPLACE VIEW public.place_data_completeness AS
WITH photo_counts AS (
  SELECT
    place_id,
    COUNT(*)::integer AS photos_count,
    COUNT(*) FILTER (WHERE is_cover)::integer AS cover_photos_count
  FROM public.place_photos
  GROUP BY place_id
),
assessed AS (
  SELECT
    p.id,
    p.name,
    p.source_kind,
    p.source_external_id,
    p.source_url,
    COALESCE(ph.photos_count, 0) AS photos_count,
    COALESCE(ph.cover_photos_count, 0) AS cover_photos_count,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN NULLIF(BTRIM(COALESCE(p.description, '')), '') IS NULL THEN 'description' END,
      CASE WHEN NULLIF(BTRIM(COALESCE(p.address, '')), '') IS NULL THEN 'address' END,
      CASE WHEN p.latitude IS NULL OR p.longitude IS NULL THEN 'coordinates' END,
      CASE WHEN NULLIF(BTRIM(COALESCE(p.phone, p.cta_phone, p.cta_whatsapp, '')), '') IS NULL THEN 'phone_or_whatsapp' END,
      CASE WHEN NULLIF(BTRIM(COALESCE(p.website, '')), '') IS NULL THEN 'website' END,
      CASE WHEN p.schedule IS NULL OR p.schedule = '{}'::jsonb THEN 'schedule' END,
      CASE WHEN p.total_reviews = 0 AND (p.source_reviews IS NULL OR p.source_reviews = '[]'::jsonb) THEN 'reviews' END,
      CASE WHEN COALESCE(ph.photos_count, 0) = 0 THEN 'photos' END,
      CASE WHEN COALESCE(ph.cover_photos_count, 0) = 0 THEN 'cover_photo' END,
      CASE WHEN NULLIF(BTRIM(COALESCE(p.source_url, '')), '') IS NULL THEN 'source_url' END
    ], NULL) AS missing_fields,
    p.created_at,
    p.updated_at
  FROM public.places p
  LEFT JOIN photo_counts ph ON ph.place_id = p.id
)
SELECT
  id,
  name,
  source_kind,
  source_external_id,
  source_url,
  photos_count,
  cover_photos_count,
  missing_fields,
  ROUND(((10 - CARDINALITY(missing_fields))::numeric / 10), 2) AS completeness_score,
  created_at,
  updated_at
FROM assessed;

ALTER VIEW public.place_data_completeness SET (security_invoker = true);


-- ############################################################################
-- ARCHIVO: 20260709000010_expand_cartagena_scraping_sources.sql
-- ############################################################################
-- ============================================================================
-- Xitty Backend - expanded Cartagena scraping source plan
-- ============================================================================
-- F1 data PR: versioned, idempotent source coverage for Cartagena. This does
-- not publish places or rehost photos automatically; it prepares admin-run
-- sources segmented by zone and Google Places type so the moderation queue can
-- be populated reproducibly.
-- ============================================================================

WITH source_seed(name, kind, config, enabled) AS (
  VALUES
    -- Centro Historico / Walled City
    (
      'Cartagena · Centro Histórico — Restaurantes',
      'google_places',
      '{"city":"Cartagena","zone":"Centro Histórico","lat":10.4220,"lng":-75.5490,"radius_m":1800,"type":"restaurant","max_results":20,"intended_category":"restaurantes"}'::jsonb,
      true
    ),
    (
      'Cartagena · Centro Histórico — Atracciones',
      'google_places',
      '{"city":"Cartagena","zone":"Centro Histórico","lat":10.4220,"lng":-75.5490,"radius_m":1800,"type":"tourist_attraction","max_results":20,"intended_category":"sitios-turisticos"}'::jsonb,
      true
    ),
    (
      'Cartagena · Centro Histórico — Eventos/venues',
      'google_places',
      '{"city":"Cartagena","zone":"Centro Histórico","lat":10.4220,"lng":-75.5490,"radius_m":1800,"type":"event_venue","max_results":20,"intended_category":"eventos"}'::jsonb,
      true
    ),

    -- Getsemani, separated from Centro to reduce accidental over-concentration.
    (
      'Cartagena · Getsemaní — Restaurantes',
      'google_places',
      '{"city":"Cartagena","zone":"Getsemaní","lat":10.4216,"lng":-75.5465,"radius_m":900,"type":"restaurant","max_results":20,"intended_category":"restaurantes"}'::jsonb,
      true
    ),
    (
      'Cartagena · Getsemaní — Atracciones',
      'google_places',
      '{"city":"Cartagena","zone":"Getsemaní","lat":10.4216,"lng":-75.5465,"radius_m":900,"type":"tourist_attraction","max_results":20,"intended_category":"sitios-turisticos"}'::jsonb,
      true
    ),

    -- San Diego / La Serrezuela
    (
      'Cartagena · San Diego — Restaurantes',
      'google_places',
      '{"city":"Cartagena","zone":"San Diego","lat":10.4275,"lng":-75.5483,"radius_m":900,"type":"restaurant","max_results":20,"intended_category":"restaurantes"}'::jsonb,
      true
    ),
    (
      'Cartagena · San Diego — Atracciones',
      'google_places',
      '{"city":"Cartagena","zone":"San Diego","lat":10.4275,"lng":-75.5483,"radius_m":900,"type":"tourist_attraction","max_results":20,"intended_category":"sitios-turisticos"}'::jsonb,
      true
    ),

    -- Bocagrande
    (
      'Cartagena · Bocagrande — Restaurantes',
      'google_places',
      '{"city":"Cartagena","zone":"Bocagrande","lat":10.3990,"lng":-75.5545,"radius_m":1500,"type":"restaurant","max_results":20,"intended_category":"restaurantes"}'::jsonb,
      true
    ),
    (
      'Cartagena · Bocagrande — Atracciones',
      'google_places',
      '{"city":"Cartagena","zone":"Bocagrande","lat":10.3990,"lng":-75.5545,"radius_m":1500,"type":"tourist_attraction","max_results":20,"intended_category":"sitios-turisticos"}'::jsonb,
      true
    ),
    (
      'Cartagena · Bocagrande — Eventos/venues',
      'google_places',
      '{"city":"Cartagena","zone":"Bocagrande","lat":10.3990,"lng":-75.5545,"radius_m":1500,"type":"event_venue","max_results":20,"intended_category":"eventos"}'::jsonb,
      true
    ),

    -- Castillogrande / El Laguito
    (
      'Cartagena · Castillogrande/El Laguito — Restaurantes',
      'google_places',
      '{"city":"Cartagena","zone":"Castillogrande/El Laguito","lat":10.3917,"lng":-75.5600,"radius_m":1300,"type":"restaurant","max_results":20,"intended_category":"restaurantes"}'::jsonb,
      true
    ),
    (
      'Cartagena · Castillogrande/El Laguito — Atracciones',
      'google_places',
      '{"city":"Cartagena","zone":"Castillogrande/El Laguito","lat":10.3917,"lng":-75.5600,"radius_m":1300,"type":"tourist_attraction","max_results":20,"intended_category":"sitios-turisticos"}'::jsonb,
      true
    ),

    -- Manga
    (
      'Cartagena · Manga — Restaurantes',
      'google_places',
      '{"city":"Cartagena","zone":"Manga","lat":10.4136,"lng":-75.5355,"radius_m":1500,"type":"restaurant","max_results":20,"intended_category":"restaurantes"}'::jsonb,
      true
    ),
    (
      'Cartagena · Manga — Atracciones',
      'google_places',
      '{"city":"Cartagena","zone":"Manga","lat":10.4136,"lng":-75.5355,"radius_m":1500,"type":"tourist_attraction","max_results":20,"intended_category":"sitios-turisticos"}'::jsonb,
      true
    ),
    (
      'Cartagena · Manga — Eventos/venues',
      'google_places',
      '{"city":"Cartagena","zone":"Manga","lat":10.4136,"lng":-75.5355,"radius_m":1500,"type":"event_venue","max_results":20,"intended_category":"eventos"}'::jsonb,
      true
    ),

    -- Crespo / Marbella
    (
      'Cartagena · Crespo/Marbella — Restaurantes',
      'google_places',
      '{"city":"Cartagena","zone":"Crespo/Marbella","lat":10.4387,"lng":-75.5181,"radius_m":2500,"type":"restaurant","max_results":20,"intended_category":"restaurantes"}'::jsonb,
      true
    ),
    (
      'Cartagena · Crespo/Marbella — Atracciones',
      'google_places',
      '{"city":"Cartagena","zone":"Crespo/Marbella","lat":10.4387,"lng":-75.5181,"radius_m":2500,"type":"tourist_attraction","max_results":20,"intended_category":"sitios-turisticos"}'::jsonb,
      true
    ),

    -- La Boquilla / Zona Norte
    (
      'Cartagena · La Boquilla/Zona Norte — Restaurantes',
      'google_places',
      '{"city":"Cartagena","zone":"La Boquilla/Zona Norte","lat":10.4710,"lng":-75.4950,"radius_m":5500,"type":"restaurant","max_results":20,"intended_category":"restaurantes"}'::jsonb,
      true
    ),
    (
      'Cartagena · La Boquilla/Zona Norte — Atracciones',
      'google_places',
      '{"city":"Cartagena","zone":"La Boquilla/Zona Norte","lat":10.4710,"lng":-75.4950,"radius_m":5500,"type":"tourist_attraction","max_results":20,"intended_category":"sitios-turisticos"}'::jsonb,
      true
    ),

    -- Baru / Pasacaballos
    (
      'Cartagena · Barú/Pasacaballos — Restaurantes',
      'google_places',
      '{"city":"Cartagena","zone":"Barú/Pasacaballos","lat":10.2469,"lng":-75.5897,"radius_m":10000,"type":"restaurant","max_results":20,"intended_category":"restaurantes"}'::jsonb,
      true
    ),
    (
      'Cartagena · Barú/Pasacaballos — Atracciones',
      'google_places',
      '{"city":"Cartagena","zone":"Barú/Pasacaballos","lat":10.2469,"lng":-75.5897,"radius_m":10000,"type":"tourist_attraction","max_results":20,"intended_category":"sitios-turisticos"}'::jsonb,
      true
    ),

    -- Islas del Rosario, important for tourist planning but kept as its own zone.
    (
      'Cartagena · Islas del Rosario — Atracciones',
      'google_places',
      '{"city":"Cartagena","zone":"Islas del Rosario","lat":10.1785,"lng":-75.7500,"radius_m":12000,"type":"tourist_attraction","max_results":20,"intended_category":"sitios-turisticos"}'::jsonb,
      true
    ),
    (
      'Cartagena · Islas del Rosario — Restaurantes',
      'google_places',
      '{"city":"Cartagena","zone":"Islas del Rosario","lat":10.1785,"lng":-75.7500,"radius_m":12000,"type":"restaurant","max_results":20,"intended_category":"restaurantes"}'::jsonb,
      true
    ),

    -- City-wide catch-all sources kept, but with explicit metadata.
    (
      'Cartagena · Ciudad (amplio) — Restaurantes',
      'google_places',
      '{"city":"Cartagena","zone":"Ciudad amplia","lat":10.4100,"lng":-75.5300,"radius_m":12000,"type":"restaurant","max_results":20,"intended_category":"restaurantes"}'::jsonb,
      true
    ),
    (
      'Cartagena · Ciudad (amplio) — Atracciones',
      'google_places',
      '{"city":"Cartagena","zone":"Ciudad amplia","lat":10.4100,"lng":-75.5300,"radius_m":12000,"type":"tourist_attraction","max_results":20,"intended_category":"sitios-turisticos"}'::jsonb,
      true
    ),
    (
      'Cartagena · Ciudad (amplio) — Eventos/venues',
      'google_places',
      '{"city":"Cartagena","zone":"Ciudad amplia","lat":10.4100,"lng":-75.5300,"radius_m":12000,"type":"event_venue","max_results":20,"intended_category":"eventos"}'::jsonb,
      true
    ),

    -- Eventbrite remains one broad source because it already accepts an address radius.
    (
      'Cartagena · Eventos',
      'eventbrite',
      '{"city":"Cartagena","zone":"Ciudad amplia","location_address":"Cartagena, Colombia","location_within_km":25,"max_results":50,"intended_category":"eventos"}'::jsonb,
      true
    )
)
INSERT INTO public.scraping_sources (name, kind, config, enabled)
SELECT name, kind, config, enabled
FROM source_seed
ON CONFLICT (name) DO UPDATE
SET
  kind = EXCLUDED.kind,
  config = EXCLUDED.config,
  enabled = EXCLUDED.enabled,
  updated_at = now();


-- ############################################################################
-- ARCHIVO: 20260709000011_city_scoped_rankings.sql
-- ############################################################################
-- ============================================================================
-- Xitty Backend - city-scoped places and rankings
-- ============================================================================
-- F7 explicitly requires rankings by city (Cartagena and Barranquilla).
-- This migration stores city/zone on imported places and extends the ranking
-- materialized view + snapshots with city and city/category positions.
-- ============================================================================

ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS zone text;

ALTER TABLE public.scraped_items_enriched
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS zone text;

COMMENT ON COLUMN public.places.city IS
  'Operational city scope for discovery/ranking, e.g. Cartagena or Barranquilla.';
COMMENT ON COLUMN public.places.zone IS
  'Operational neighborhood/zone inside the city, used for data QA and planning.';
COMMENT ON COLUMN public.scraped_items_enriched.city IS
  'Copied from scraping_sources.config.city when available.';
COMMENT ON COLUMN public.scraped_items_enriched.zone IS
  'Copied from scraping_sources.config.zone when available.';

UPDATE public.places
SET city = 'Cartagena'
WHERE city IS NULL
  AND (
    address ILIKE '%Cartagena%'
    OR source_url ILIKE '%cartagena%'
    OR data_provenance::text ILIKE '%Cartagena%'
  );

UPDATE public.places
SET city = 'Barranquilla'
WHERE city IS NULL
  AND (
    address ILIKE '%Barranquilla%'
    OR source_url ILIKE '%barranquilla%'
    OR data_provenance::text ILIKE '%Barranquilla%'
  );

CREATE INDEX IF NOT EXISTS places_city_active_idx
  ON public.places (city, is_active)
  WHERE city IS NOT NULL;

CREATE INDEX IF NOT EXISTS places_city_category_active_idx
  ON public.places (city, category_id, is_active)
  WHERE city IS NOT NULL;

CREATE INDEX IF NOT EXISTS scraped_items_enriched_city_status_idx
  ON public.scraped_items_enriched (city, status)
  WHERE city IS NOT NULL;

ALTER TABLE public.ranking_snapshots
  ADD COLUMN IF NOT EXISTS city text;

ALTER TABLE public.ranking_snapshots
  DROP CONSTRAINT IF EXISTS ranking_snapshots_scope_check;

ALTER TABLE public.ranking_snapshots
  ADD CONSTRAINT ranking_snapshots_scope_check
  CHECK (scope IN ('global', 'category', 'city', 'city_category'));

CREATE INDEX IF NOT EXISTS ranking_snapshots_scope_city_date_idx
  ON public.ranking_snapshots (scope, city, snapshot_at DESC, place_id);

CREATE INDEX IF NOT EXISTS ranking_snapshots_scope_city_category_date_idx
  ON public.ranking_snapshots (scope, city, category_id, snapshot_at DESC, place_id);

DROP MATERIALIZED VIEW IF EXISTS public.place_rankings;

CREATE MATERIALIZED VIEW public.place_rankings AS
WITH config AS (
  SELECT *
  FROM public.ranking_config
  WHERE id = 'default'
),
activity AS (
  SELECT
    mi.place_id,
    COUNT(*) FILTER (WHERE mi.interaction_type = 'profile_view') AS views_30d,
    COUNT(*) FILTER (WHERE mi.interaction_type IN (
      'call_click',
      'whatsapp_click',
      'reservation_click',
      'directions_click'
    )) AS conversions_30d
  FROM public.microsite_interactions mi
  CROSS JOIN config c
  WHERE mi.created_at >= now() - make_interval(days => c.window_days)
  GROUP BY mi.place_id
),
components AS (
  SELECT
    p.id AS place_id,
    p.category_id,
    NULLIF(BTRIM(p.city), '') AS city,
    NULLIF(BTRIM(p.zone), '') AS zone,
    COALESCE(a.views_30d, 0) AS views_30d,
    COALESCE(a.conversions_30d, 0) AS conversions_30d,
    COALESCE(
      (
        (
          (COALESCE(p.average_rating, 0)::numeric * COALESCE(p.total_reviews, 0))
          + (c.rating_prior * c.rating_prior_reviews)
        )
        / NULLIF(COALESCE(p.total_reviews, 0) + c.rating_prior_reviews, 0)
      ) / 5.0,
      c.rating_prior / 5.0
    ) AS rating_score,
    LEAST(
      LN(COALESCE(a.views_30d, 0)::numeric + 1)
      / NULLIF(LN(c.views_cap::numeric + 1), 0),
      1.0
    ) AS views_score,
    LEAST(
      LN(COALESCE(a.conversions_30d, 0)::numeric + 1)
      / NULLIF(LN(c.conversions_cap::numeric + 1), 0),
      1.0
    ) AS conversions_score,
    (c.rating_weight + c.views_weight + c.conversions_weight) AS total_weight,
    c.rating_weight,
    c.views_weight,
    c.conversions_weight
  FROM public.places p
  CROSS JOIN config c
  LEFT JOIN activity a ON a.place_id = p.id
  WHERE p.is_active = true
),
scored AS (
  SELECT
    place_id,
    category_id,
    city,
    zone,
    views_30d,
    conversions_30d,
    ROUND(rating_score, 4) AS rating_score,
    ROUND(views_score, 4) AS views_score,
    ROUND(conversions_score, 4) AS conversions_score,
    ROUND(
      (
        rating_score * rating_weight
        + views_score * views_weight
        + conversions_score * conversions_weight
      ) / NULLIF(total_weight, 0),
      4
    ) AS score
  FROM components
)
SELECT
  place_id,
  category_id,
  city,
  zone,
  views_30d,
  conversions_30d,
  rating_score,
  views_score,
  conversions_score,
  score,
  RANK() OVER (ORDER BY score DESC, place_id ASC) AS global_position,
  RANK() OVER (PARTITION BY category_id ORDER BY score DESC, place_id ASC) AS category_position,
  RANK() OVER (PARTITION BY city ORDER BY score DESC, place_id ASC) AS city_position,
  RANK() OVER (PARTITION BY city, category_id ORDER BY score DESC, place_id ASC) AS city_category_position,
  RANK() OVER (ORDER BY score DESC, place_id ASC) AS position
FROM scored;

CREATE UNIQUE INDEX IF NOT EXISTS place_rankings_place_id_uidx
  ON public.place_rankings (place_id);

CREATE INDEX IF NOT EXISTS place_rankings_global_position_idx
  ON public.place_rankings (global_position);

CREATE INDEX IF NOT EXISTS place_rankings_category_position_idx
  ON public.place_rankings (category_id, category_position);

CREATE INDEX IF NOT EXISTS place_rankings_city_position_idx
  ON public.place_rankings (city, city_position)
  WHERE city IS NOT NULL;

CREATE INDEX IF NOT EXISTS place_rankings_city_category_position_idx
  ON public.place_rankings (city, category_id, city_category_position)
  WHERE city IS NOT NULL;

CREATE INDEX IF NOT EXISTS place_rankings_score_idx
  ON public.place_rankings (score DESC);

CREATE OR REPLACE FUNCTION public.refresh_place_rankings()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_started_at timestamptz := clock_timestamp();
  v_rankings_count integer := 0;
  v_snapshots_count integer := 0;
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.place_rankings;

  SELECT COUNT(*) INTO v_rankings_count
  FROM public.place_rankings;

  WITH inserted AS (
    INSERT INTO public.ranking_snapshots (
      scope,
      city,
      category_id,
      place_id,
      position,
      score,
      snapshot_at
    )
    SELECT
      'global',
      NULL,
      NULL,
      place_id,
      global_position,
      score,
      now()
    FROM public.place_rankings
    UNION ALL
    SELECT
      'category',
      NULL,
      category_id,
      place_id,
      category_position,
      score,
      now()
    FROM public.place_rankings
    UNION ALL
    SELECT
      'city',
      city,
      NULL,
      place_id,
      city_position,
      score,
      now()
    FROM public.place_rankings
    WHERE city IS NOT NULL
    UNION ALL
    SELECT
      'city_category',
      city,
      category_id,
      place_id,
      city_category_position,
      score,
      now()
    FROM public.place_rankings
    WHERE city IS NOT NULL
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_snapshots_count
  FROM inserted;

  INSERT INTO public.ranking_refresh_logs (
    status,
    started_at,
    finished_at,
    rankings_count,
    snapshots_count
  ) VALUES (
    'success',
    v_started_at,
    clock_timestamp(),
    v_rankings_count,
    v_snapshots_count
  );
END;
$$;

SELECT public.refresh_place_rankings();


-- ############################################################################
-- ARCHIVO: 20260709000012_filter_nearby_places_by_city_zone.sql
-- ############################################################################
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


-- ############################################################################
-- ARCHIVO: 20260709000013_harden_backend_service_role_and_place_rpc.sql
-- ############################################################################
-- ============================================================================
-- Xitty Backend - service role privileges and nearby places RPC cleanup
-- ============================================================================
-- Clean Supabase projects do not automatically grant application-table access to
-- service_role. The Nest backend uses service_role for data access while keeping
-- user/business/admin authorization in application code + RLS policies.
--
-- This migration also removes pre-city overloads of list_places_near so PostgREST
-- has one city/zone-aware RPC signature to resolve.
-- ============================================================================

DROP FUNCTION IF EXISTS public.list_places_near(
  double precision,
  double precision,
  uuid,
  smallint,
  integer,
  integer
);

DROP FUNCTION IF EXISTS public.list_places_near(
  double precision,
  double precision,
  uuid,
  smallint,
  integer,
  integer,
  integer
);

GRANT USAGE ON SCHEMA public TO service_role;

DO $$
DECLARE
  app_relation record;
BEGIN
  FOR app_relation IN
    SELECT n.nspname AS schema_name, c.relname AS relation_name, c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend d
        JOIN pg_extension e ON e.oid = d.refobjid
        WHERE d.objid = c.oid
          AND d.deptype = 'e'
      )
  LOOP
    IF app_relation.relkind IN ('r', 'p') THEN
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I.%I TO service_role',
        app_relation.schema_name,
        app_relation.relation_name
      );
    ELSE
      EXECUTE format(
        'GRANT SELECT ON TABLE %I.%I TO service_role',
        app_relation.schema_name,
        app_relation.relation_name
      );
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  app_sequence record;
BEGIN
  FOR app_sequence IN
    SELECT n.nspname AS schema_name, c.relname AS sequence_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'S'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend d
        JOIN pg_extension e ON e.oid = d.refobjid
        WHERE d.objid = c.oid
          AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format(
      'GRANT USAGE, SELECT, UPDATE ON SEQUENCE %I.%I TO service_role',
      app_sequence.schema_name,
      app_sequence.sequence_name
    );
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.compute_recommendations_for(
  uuid,
  double precision,
  double precision,
  integer
) TO service_role;

GRANT EXECUTE ON FUNCTION public.experience_rating_distribution(uuid)
  TO service_role;

GRANT EXECUTE ON FUNCTION public.increment_chat_usage(uuid)
  TO service_role;

GRANT EXECUTE ON FUNCTION public.list_places_near(
  double precision,
  double precision,
  uuid,
  smallint,
  text,
  text,
  integer,
  integer,
  integer
) TO service_role;

GRANT EXECUTE ON FUNCTION public.place_metrics_summary(
  uuid,
  timestamp with time zone,
  timestamp with time zone
) TO service_role;

GRANT EXECUTE ON FUNCTION public.place_metrics_timeseries(
  uuid,
  timestamp with time zone,
  timestamp with time zone,
  text
) TO service_role;

GRANT EXECUTE ON FUNCTION public.refresh_place_rankings()
  TO service_role;

GRANT EXECUTE ON FUNCTION public.suggestions_for(
  double precision,
  double precision
) TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO service_role;


-- ############################################################################
-- ARCHIVO: 20260709000014_extend_place_data_completeness_report.sql
-- ############################################################################
-- ============================================================================
-- Xitty Backend - richer place data completeness report
-- ============================================================================
-- Keeps F1 operations visible after scraper runs: the report now includes city,
-- zone and category breakdown inputs without touching place data.
-- ============================================================================

DROP VIEW IF EXISTS public.place_data_completeness;

CREATE VIEW public.place_data_completeness AS
WITH photo_counts AS (
  SELECT
    place_id,
    COUNT(*)::integer AS photos_count,
    COUNT(*) FILTER (WHERE is_cover)::integer AS cover_photos_count
  FROM public.place_photos
  GROUP BY place_id
),
assessed AS (
  SELECT
    p.id,
    p.name,
    p.city,
    p.zone,
    p.category_id,
    c.name AS category_name,
    c.slug AS category_slug,
    p.source_kind,
    p.source_external_id,
    p.source_url,
    COALESCE(ph.photos_count, 0) AS photos_count,
    COALESCE(ph.cover_photos_count, 0) AS cover_photos_count,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN NULLIF(BTRIM(COALESCE(p.description, '')), '') IS NULL THEN 'description' END,
      CASE WHEN NULLIF(BTRIM(COALESCE(p.address, '')), '') IS NULL THEN 'address' END,
      CASE WHEN p.latitude IS NULL OR p.longitude IS NULL THEN 'coordinates' END,
      CASE WHEN NULLIF(BTRIM(COALESCE(p.phone, p.cta_phone, p.cta_whatsapp, '')), '') IS NULL THEN 'phone_or_whatsapp' END,
      CASE WHEN NULLIF(BTRIM(COALESCE(p.website, '')), '') IS NULL THEN 'website' END,
      CASE WHEN p.schedule IS NULL OR p.schedule = '{}'::jsonb THEN 'schedule' END,
      CASE WHEN p.total_reviews = 0 AND (p.source_reviews IS NULL OR p.source_reviews = '[]'::jsonb) THEN 'reviews' END,
      CASE WHEN COALESCE(ph.photos_count, 0) = 0 THEN 'photos' END,
      CASE WHEN COALESCE(ph.cover_photos_count, 0) = 0 THEN 'cover_photo' END,
      CASE WHEN NULLIF(BTRIM(COALESCE(p.source_url, '')), '') IS NULL THEN 'source_url' END
    ], NULL) AS missing_fields,
    p.created_at,
    p.updated_at
  FROM public.places p
  LEFT JOIN public.categories c ON c.id = p.category_id
  LEFT JOIN photo_counts ph ON ph.place_id = p.id
)
SELECT
  id,
  name,
  city,
  zone,
  category_id,
  category_name,
  category_slug,
  source_kind,
  source_external_id,
  source_url,
  photos_count,
  cover_photos_count,
  missing_fields,
  CARDINALITY(missing_fields) AS missing_count,
  ROUND(((10 - CARDINALITY(missing_fields))::numeric / 10), 2) AS completeness_score,
  created_at,
  updated_at
FROM assessed;

ALTER VIEW public.place_data_completeness SET (security_invoker = true);

GRANT SELECT ON TABLE public.place_data_completeness TO service_role;


-- ############################################################################
-- ARCHIVO: 20260709000015_add_reservation_created_notifications.sql
-- ############################################################################
-- ============================================================================
-- Xitty Backend - reservation-created notifications
-- ============================================================================
-- F6 initially queued CTA clicks and daily summaries. Actual experience
-- reservations should also notify the operator through the same provider-neutral
-- outbox while the external delivery channel remains pending.
-- ============================================================================

ALTER TABLE public.business_notification_outbox
  DROP CONSTRAINT IF EXISTS business_notification_outbox_notification_type_check;

ALTER TABLE public.business_notification_outbox
  ADD CONSTRAINT business_notification_outbox_notification_type_check
  CHECK (notification_type IN (
    'call_click',
    'whatsapp_click',
    'reservation_click',
    'reservation_created',
    'daily_summary'
  ));

COMMENT ON CONSTRAINT business_notification_outbox_notification_type_check
  ON public.business_notification_outbox IS
  'Provider-neutral notification types captured before external delivery is configured.';


-- ############################################################################
-- ARCHIVO: 20260723000001_fix_seed_content_data.sql
-- ############################################################################
-- ============================================================================
-- Fix de contenido en datos de producción (auditoría #20, #29, #30)
-- ============================================================================
-- Estos son arreglos de VALORES de datos que ya viven en producción (no basta
-- con corregir el seed). Son idempotentes: correrlos varias veces no rompe nada.
-- ----------------------------------------------------------------------------

-- #20 — Typo en el nombre de la fuente de scraping ("plances" → "Planes").
UPDATE public.scraping_sources
SET name = 'Planes Barranquilla'
WHERE name ILIKE '%plances%';

-- #30 — Nombre de negocio en broma ("Narcobollo") → nombre legítimo.
UPDATE public.places
SET name = 'Bollo Gourmet',
    website = 'https://bollogourmet.com.co'
WHERE name = 'Narcobollo';

-- alt_text de la foto que mencionaba el nombre viejo.
UPDATE public.place_photos
SET alt_text = 'Bollos rellenos gourmet de la casa'
WHERE alt_text = 'Bollos rellenos gourmet de Narcobollo';

-- #29 (parcial) — Tildes/eñes faltantes en promociones ya sembradas. Sin la ñ,
-- "ano" y "anos" se leen mal. REPLACE puntual e idempotente sobre título y
-- descripción de las promociones existentes.
UPDATE public.promotions
SET title = replace(replace(replace(replace(title,
      'fin de ano', 'fin de año'),
      'Ninos', 'Niños'),
      'cocteles', 'cócteles'),
      'miercoles', 'miércoles'),
    description = replace(replace(replace(replace(replace(description,
      'fin de ano', 'fin de año'),
      ' 10 anos', ' 10 años'),
      'los ninos', 'los niños'),
      'acompanados', 'acompañados'),
      'dos ninos', 'dos niños')
WHERE title  ILIKE '%ano%'
   OR title  ILIKE '%Ninos%'
   OR title  ILIKE '%cocteles%'
   OR title  ILIKE '%miercoles%'
   OR description ILIKE '%ano%'
   OR description ILIKE '%ninos%';

