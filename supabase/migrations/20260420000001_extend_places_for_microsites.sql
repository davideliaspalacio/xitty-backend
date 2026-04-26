-- ============================================================================
-- M5 — Extend places for microsites: slug + CTA fields
-- ============================================================================

-- Add new columns to places
ALTER TABLE public.places ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.places ADD COLUMN IF NOT EXISTS cta_phone text;
ALTER TABLE public.places ADD COLUMN IF NOT EXISTS cta_whatsapp text;
ALTER TABLE public.places ADD COLUMN IF NOT EXISTS reservation_url text;

-- Helper: generate URL-friendly slug from text
CREATE OR REPLACE FUNCTION public.generate_slug(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result text;
BEGIN
  -- lowercase, remove tildes, replace non-alphanumeric with dash, collapse dashes, trim
  result := lower(input);
  result := translate(result,
    'áéíóúüñÁÉÍÓÚÜÑ',
    'aeiouunAEIOUUN');
  result := regexp_replace(result, '[^a-z0-9]+', '-', 'g');
  result := regexp_replace(result, '^-+|-+$', '', 'g');
  RETURN result;
END;
$$;

-- Trigger to auto-generate slug from name if null, ensuring uniqueness
CREATE OR REPLACE FUNCTION public.places_set_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug text;
  candidate text;
  counter int := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := public.generate_slug(NEW.name);
    candidate := base_slug;
    -- Ensure uniqueness by appending counter if needed
    WHILE EXISTS (
      SELECT 1 FROM public.places
      WHERE slug = candidate AND id IS DISTINCT FROM NEW.id
    ) LOOP
      counter := counter + 1;
      candidate := base_slug || '-' || counter;
    END LOOP;
    NEW.slug := candidate;
  ELSE
    -- Normalize manually-provided slug
    NEW.slug := public.generate_slug(NEW.slug);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS places_set_slug_trigger ON public.places;
CREATE TRIGGER places_set_slug_trigger
  BEFORE INSERT OR UPDATE OF name, slug ON public.places
  FOR EACH ROW
  EXECUTE FUNCTION public.places_set_slug();

-- Backfill slugs for existing places
UPDATE public.places SET slug = NULL WHERE slug IS NULL;
-- The above triggers a no-op; do an explicit update to fire the trigger
UPDATE public.places SET name = name WHERE slug IS NULL OR slug = '';

-- Add unique constraint after backfill
ALTER TABLE public.places ADD CONSTRAINT places_slug_unique UNIQUE (slug);

CREATE INDEX IF NOT EXISTS places_slug_idx ON public.places (slug);
