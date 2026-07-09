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
