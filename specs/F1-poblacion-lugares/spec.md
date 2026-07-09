# F1 - Poblacion de lugares: trazabilidad y reporte

## Objetivo

Cerrar el gap tecnico que impide cargar lugares reales con confianza: al publicar items del scraper, cada lugar debe conservar fuente/proveniencia, evitar duplicados por la misma fuente y quedar medible en un reporte de completitud.

## Historias y criterios de aceptacion

### US-F1-01 - Publicacion trazable

Given un item scrapeado con `source_kind`, `source_external_id` y `source_url`, when el admin lo publica como lugar, then el lugar guarda esos campos y un `data_provenance` con los datos que vinieron de la fuente.

Given un campo no viene de la fuente, when se publica, then queda `null`; no se inventa.

### US-F1-02 - Idempotencia al publicar

Given ya existe un lugar con el mismo `source_kind + source_external_id`, when se publica otro item equivalente, then no se crea un segundo lugar; el item se marca como publicado apuntando al lugar existente.

Given no existe identidad externa pero si `source_url`, when se publica, then se usa `source_url` como fallback de deduplicacion.

### US-F1-03 - Reporte de faltantes

Given hay lugares publicados, when se consulta la vista de reporte, then se obtiene por lugar: conteo de fotos, campos faltantes y porcentaje de completitud.

Given un lugar no tiene fotos/licencia aprobada, when se consulta el reporte, then aparece `photos` o `cover_photo` en `missing_fields`.

## Modelo de datos

- `places.source_kind`
- `places.source_external_id`
- `places.source_url`
- `places.data_provenance`
- `scraped_items_enriched.source_kind`
- `scraped_items_enriched.source_external_id`
- Vista `place_data_completeness`.

## API

No se agregan endpoints publicos. El cambio vive en:

- `POST /admin/scraping/items/:id/publish`

## Reglas de autorizacion

- Solo admin puede publicar items del scraper.
- La vista usa `security_invoker` para respetar RLS del caller.
- El backend sigue usando service role para moderacion/admin.

## UI/UX

Sin cambios de UI en este PR. El reporte queda disponible como vista SQL para operaciones/QA.

## Edge cases

- Lugares duplicados por misma fuente: se reutiliza el lugar existente.
- Lugares sin telefono/WhatsApp/web/horarios/fotos: quedan `null` y aparecen en reporte.
- Categorias nuevas: este PR no cambia el mapeo; se conservan tags/category_hint.
- Re-ejecucion/publicacion repetida: no duplica por identidad externa o source_url.
- Caracteres especiales: se conserva el flujo existente de slug/nombre.

## Fuera de alcance

- Descargar/subir fotos nuevas sin politica de licencia aprobada.
- Cargar una lista masiva definitiva en produccion.
- UI del reporte.
