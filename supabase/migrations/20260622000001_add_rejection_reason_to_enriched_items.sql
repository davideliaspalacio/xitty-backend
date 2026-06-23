-- ============================================================================
-- Xitty Discover — agrega `rejection_reason` a scraped_items_enriched
-- ============================================================================
-- El panel admin de moderacion permite rechazar items con una razon humana
-- (visible para el equipo). La razon se persiste en la misma fila junto con
-- reviewed_by / reviewed_at para preservar la auditoria completa de la
-- decision.
--
-- Columna nullable: items aprobados / pendientes / publicados no la usan.
-- Limite suave de longitud (no enforced en DB para evitar tirar updates por
-- texto largo — el DTO ya limita a 500 chars).
-- ============================================================================

ALTER TABLE public.scraped_items_enriched
  ADD COLUMN IF NOT EXISTS rejection_reason text;

COMMENT ON COLUMN public.scraped_items_enriched.rejection_reason IS
  'Razon humana del rechazo, completada cuando status=rejected via /admin/scraping/items/:id/reject';
