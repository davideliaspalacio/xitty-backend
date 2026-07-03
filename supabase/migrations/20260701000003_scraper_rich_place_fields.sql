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
