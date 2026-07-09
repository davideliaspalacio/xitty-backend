# Plan F1 - Poblacion de lugares: trazabilidad y reporte

## Checklist

- [x] Auditar proceso actual de Cartagena/scraper.
- [x] Documentar gap: faltaba proveniencia persistida en `places`.
- [x] Agregar migracion de columnas de fuente y reporte de completitud.
- [x] Pasar identidad externa desde executor a enriched.
- [x] Publicar lugares de forma idempotente por fuente/source URL.
- [x] Agregar tests de publicacion idempotente y proveniencia.
- [x] Correr tests, build y lint dirigido.
- [x] Abrir PR apilado.

## Migracion SQL

Archivo: `supabase/migrations/20260709000009_place_source_provenance_report.sql`

- Agrega campos de fuente a `places` y `scraped_items_enriched`.
- Agrega indices unicos parciales para evitar duplicados por fuente.
- Crea vista `place_data_completeness` con `missing_fields` y `completeness_score`.

## Tests

- AdminScrapingService:
  - publica un place guardando fuente/proveniencia.
  - si existe un place con la misma identidad externa, reutiliza el id y no inserta duplicado.
  - si no hay identidad externa, deduplica por `source_url`.

## Riesgos

- Bajo: las columnas nuevas son nullable y no alteran lugares existentes.
- Medio: la politica exacta de fotos sigue pendiente; este PR no descarga ni publica nuevas fotos por fuera del flujo existente.
- Bajo: si hay datos historicos sin source, el reporte los marca como faltantes sin romper la app.

## Evidencia

- Backend tests: `npm test -- --runInBand src/modules/scraping/admin/admin-scraping.service.spec.ts src/modules/scraping/executor/scraping-executor.service.spec.ts src/modules/scraping/storage/scraped-items.repo.spec.ts` -> 3 suites / 58 tests OK.
- Backend build: `npm run build` -> OK.
- Backend lint dirigido: `npx eslint src/modules/scraping/admin/admin-scraping.service.ts src/modules/scraping/executor/scraping-executor.service.ts src/modules/scraping/storage/scraped-items.repo.ts` -> OK.
- Backend PR: <https://github.com/davideliaspalacio/xitty-backend/pull/30>.
