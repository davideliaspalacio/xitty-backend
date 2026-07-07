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
