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
