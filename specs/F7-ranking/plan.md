# Plan F7 - Ranking inteligente

## Checklist

- [x] Auditar ranking existente.
- [x] Crear spec de cierre de gaps.
- [x] Crear migracion de configuracion, snapshots global/categoria y view mejorada.
- [x] Ajustar servicio para ranking global real y delta semanal.
- [x] Ajustar UI para delta visible.
- [x] Agregar tests backend/frontend.
- [ ] Abrir PRs apilados.

## Migracion SQL

Archivo: `supabase/migrations/20260709000005_improve_place_rankings.sql`

- Agrega `ranking_config`.
- Agrega `ranking_refresh_logs`.
- Agrega `ranking_snapshots.scope`.
- Reemplaza `place_rankings` con score bayesiano + posiciones global/categoria.
- Reemplaza `refresh_place_rankings()` para insertar snapshots global/categoria y log de refresh.
- Reprograma cron `refresh-place-rankings` a 08:00 UTC si `pg_cron` esta disponible.

No borra datos de lugares/interacciones. Recalcula la view.

## Estrategia de tests

- Backend:
  - global usa `global_position`.
  - categoria usa `category_position`.
  - snapshots previos se filtran por scope y 7 dias.
  - patrocinados se muestran arriba sin cambiar `position` organica.
- Frontend:
  - ranking card muestra `+N`, `-N` o neutro segun `position_change`.
  - sello `Patrocinado` permanece visible.

## Impacto

- `GET /ranking` conserva contrato publico.
- `GET /ranking/categories/:categoryId` conserva contrato publico.
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
