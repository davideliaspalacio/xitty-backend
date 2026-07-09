# Plan F7 - Ranking inteligente

## Checklist

- [x] Auditar ranking existente.
- [x] Crear spec de cierre de gaps.
- [x] Crear migracion de configuracion, snapshots global/categoria y view mejorada.
- [x] Ajustar servicio para ranking global real y delta semanal.
- [x] Ajustar UI para delta visible.
- [x] Agregar tests backend/frontend.
- [x] Abrir PRs apilados.
- [x] Cerrar gap de ranking por ciudad con `city`/`zone` y snapshots city/city_category.

## Migracion SQL

Archivo: `supabase/migrations/20260709000005_improve_place_rankings.sql`

- Agrega `ranking_config`.
- Agrega `ranking_refresh_logs`.
- Agrega `ranking_snapshots.scope`.
- Reemplaza `place_rankings` con score bayesiano + posiciones global/categoria.
- Reemplaza `refresh_place_rankings()` para insertar snapshots global/categoria y log de refresh.
- Reprograma cron `refresh-place-rankings` a 08:00 UTC si `pg_cron` esta disponible.

No borra datos de lugares/interacciones. Recalcula la view.

Archivo adicional: `supabase/migrations/20260709000011_city_scoped_rankings.sql`

- Agrega `places.city`, `places.zone`, `scraped_items_enriched.city`, `scraped_items_enriched.zone`.
- Backfill best-effort por direccion/source para Cartagena y Barranquilla.
- Reemplaza `place_rankings` agregando `city_position` y `city_category_position`.
- Extiende `ranking_snapshots.scope` con `city` y `city_category`.
- Reemplaza `refresh_place_rankings()` para guardar snapshots global/category/city/city_category.

## Estrategia de tests

- Backend:
  - global usa `global_position`.
  - categoria usa `category_position`.
  - snapshots previos se filtran por scope y 7 dias.
  - ranking por ciudad usa `city_position` y snapshots scope `city`.
  - ranking por ciudad+categoria usa `city_category_position`.
  - patrocinados se muestran arriba sin cambiar `position` organica.
- Frontend:
  - ranking card muestra `+N`, `-N` o neutro segun `position_change`.
  - sello `Patrocinado` permanece visible.

## Impacto

- `GET /ranking` conserva contrato publico.
- `GET /ranking/categories/:categoryId` conserva contrato publico.
- `GET /ranking?city=Cartagena` y `GET /ranking/categories/:categoryId?city=Cartagena` agregan scope nuevo sin romper los anteriores.
- Recommendations que leen `place_rankings.score` siguen funcionando.
- Patrocinios siguen siendo overlay de presentacion, no contaminan score organico.

## Riesgos

- Medio: reemplazar materialized view requiere que no existan dependencias con columnas removidas; se conservan `position` y `score` por compatibilidad.
- Bajo: `pg_cron` puede no estar habilitado; queda refresh manual y notice como hoy.

## Evidencia

- Backend: `npm test -- --runInBand src/modules/ranking/ranking.service.spec.ts` -> 1 suite / 11 tests OK.
- Backend: `npm run build` -> OK.
- Backend lint dirigido: `npx eslint src/modules/ranking/ranking.service.ts` -> OK.
- Frontend: `npm run test:run -- src/features/discover/__tests__/ranking-card.test.tsx` -> 1 file / 3 tests OK.
- Frontend: `npm run typecheck` -> OK.
- Frontend: `npm run build` -> OK.
- Backend PR: <https://github.com/davideliaspalacio/xitty-backend/pull/26>.
- Frontend PR: <https://github.com/davideliaspalacio/xitty-frontend/pull/22>.
- Backend city tests: `npm test -- --runInBand src/modules/ranking/ranking.service.spec.ts src/modules/scraping/admin/admin-scraping.service.spec.ts src/modules/scraping/executor/scraping-executor.service.spec.ts src/modules/scraping/storage/scraped-items.repo.spec.ts` -> 4 suites / 73 tests OK.
- Backend city build: `npm run build` -> OK.
- Backend city lint dirigido: `npx eslint src/modules/ranking/ranking.service.ts src/modules/ranking/ranking.controller.ts src/modules/ranking/dto/ranking-query.dto.ts src/modules/ranking/dto/ranking-response.dto.ts src/modules/scraping/admin/admin-scraping.service.ts src/modules/scraping/executor/scraping-executor.service.ts src/modules/scraping/storage/scraped-items.repo.ts` -> OK.
