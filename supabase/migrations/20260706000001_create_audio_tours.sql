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
