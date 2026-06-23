-- ============================================================================
-- i18n foundation — add translations column to places + experiences
-- ============================================================================
-- Adds a jsonb `translations` column to translatable catalog tables and a
-- helper function + RPC to fetch localized rows.
--
-- Shape of the translations column:
--   {
--     "en": { "name": "...", "description": "..." },
--     "fr": { "name": "...", "description": "..." },
--     "pt": { "name": "...", "description": "..." }
--   }
--
-- For experiences the translatable field is `title` instead of `name`. Both
-- shapes are supported by the localized() helper below.
--
-- This is a non-breaking change: existing queries (without ?lang) keep working
-- because:
--   1. the new column defaults to '{}'::jsonb
--   2. the helper function only overrides fields when translations[lang] is set
--   3. existing SELECTs that don't reference `translations` are unaffected
-- ============================================================================

-- 1) Places ------------------------------------------------------------------
ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.places.translations IS
  'i18n overrides keyed by ISO 639-1 language code. structure: {"en": {"name": "...", "description": "..."}, "fr": {...}, ...}. Base language is "es"; missing keys fall back to the base columns.';

-- 2) Experiences -------------------------------------------------------------
ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.experiences.translations IS
  'i18n overrides keyed by ISO 639-1 language code. structure: {"en": {"title": "...", "description": "..."}, "fr": {...}, ...}. Base language is "es"; missing keys fall back to the base columns.';

-- 3) localized(record, lang) -------------------------------------------------
-- Returns a jsonb representation of the record with name/title/description
-- overridden by translations[lang] when present.
--
-- Designed to be used like:
--   SELECT public.localized(to_jsonb(p), 'en') FROM places p;
CREATE OR REPLACE FUNCTION public.localized(record jsonb, lang text)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  entry jsonb;
BEGIN
  IF record IS NULL THEN
    RETURN NULL;
  END IF;

  -- "es" is the base language; no override needed. Also bail out when lang is
  -- empty/null or the translations key for that lang is missing.
  IF lang IS NULL OR lang = '' OR lang = 'es' THEN
    RETURN record;
  END IF;

  entry := record -> 'translations' -> lang;
  IF entry IS NULL OR jsonb_typeof(entry) <> 'object' THEN
    RETURN record;
  END IF;

  -- Merge translatable fields (name, title, description) when present.
  IF entry ? 'name' THEN
    record := jsonb_set(record, '{name}', entry -> 'name');
  END IF;
  IF entry ? 'title' THEN
    record := jsonb_set(record, '{title}', entry -> 'title');
  END IF;
  IF entry ? 'description' THEN
    record := jsonb_set(record, '{description}', entry -> 'description');
  END IF;

  RETURN record;
END;
$$;

COMMENT ON FUNCTION public.localized(jsonb, text) IS
  'Returns the record with name/title/description overridden by translations[lang] when present. Pass-through for lang=''es'' or null.';

-- 4) RPC: localized_places(p_lang) ------------------------------------------
-- Returns the active places set with name/description swapped in for the
-- requested language. When p_lang is null or "es", behaves like a plain
-- SELECT * FROM places WHERE is_active = true.
--
-- Note: the function returns SETOF places so the row shape stays identical to
-- the underlying table — clients keep their existing types.
CREATE OR REPLACE FUNCTION public.localized_places(p_lang text DEFAULT 'es')
RETURNS SETOF public.places
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  IF p_lang IS NULL OR p_lang = '' OR p_lang = 'es' THEN
    RETURN QUERY
      SELECT * FROM public.places WHERE is_active = true;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.description,
    p.address,
    p.latitude,
    p.longitude,
    p.phone,
    p.website,
    p.price_range,
    p.schedule,
    p.category_id,
    p.owner_id,
    p.tags,
    p.average_rating,
    p.total_reviews,
    p.is_active,
    p.created_at,
    p.updated_at,
    p.search_vector,
    p.slug,
    p.cta_phone,
    p.cta_whatsapp,
    p.reservation_url,
    p.is_sponsored,
    p.sponsored_until,
    p.translations
  FROM public.places p
  WHERE p.is_active = true;
END;
$$;

-- The body above only enumerates the columns we know exist. To stay safe
-- against future column additions we replace it with a version that uses
-- the helper to override fields on a jsonb roundtrip — but Postgres requires
-- a fixed return type for SETOF, so we keep the column projection and rely on
-- per-row override via the helper. Switch to the row-aware version:
CREATE OR REPLACE FUNCTION public.localized_places(p_lang text DEFAULT 'es')
RETURNS SETOF public.places
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  r public.places%ROWTYPE;
  override jsonb;
BEGIN
  IF p_lang IS NULL OR p_lang = '' OR p_lang = 'es' THEN
    FOR r IN SELECT * FROM public.places WHERE is_active = true LOOP
      RETURN NEXT r;
    END LOOP;
    RETURN;
  END IF;

  FOR r IN SELECT * FROM public.places WHERE is_active = true LOOP
    override := r.translations -> p_lang;
    IF override IS NOT NULL AND jsonb_typeof(override) = 'object' THEN
      IF override ? 'name' THEN
        r.name := override ->> 'name';
      END IF;
      IF override ? 'description' THEN
        r.description := override ->> 'description';
      END IF;
    END IF;
    RETURN NEXT r;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.localized_places(text) IS
  'Active places with name/description localized to p_lang. Falls back to base columns when translations[p_lang] is missing. p_lang=''es'' or null is a pass-through.';
