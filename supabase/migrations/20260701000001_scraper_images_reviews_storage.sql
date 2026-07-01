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
