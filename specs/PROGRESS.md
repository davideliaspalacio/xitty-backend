# Progreso SDD - Features v2

Objetivo operativo: avanzar sin gates bloqueantes durante la noche, manteniendo specs, planes, pruebas y trazabilidad por feature.

| Feature                        | Estado                               | Rama/PR                            | Proximo paso                                                                        |
| ------------------------------ | ------------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------- |
| F1 Poblacion de lugares        | Parcial auditado                     | Pendiente                          | Esperar politica de fotos/licencias y preparar seed/reporte idempotente.            |
| F2 Perfil publico URL propia   | Implementado, pendiente PR/QA amplio | `feature/f2-public-slugs-og`       | Abrir PR apilado despues de F5.                                                     |
| F3 Promociones                 | PR abierto, pendiente review/merge   | Backend #25 / Frontend #21         | Mergear despues de F2 backend #24 y frontend #20.                                   |
| F4 Tracking de eventos         | Implementado, pendiente PR/QA amplio | `feature/f4-tracking-anti-inflado` | Abrir PR coordinado backend/frontend y correr suite amplia si el tiempo lo permite. |
| F5 Dashboard metricas          | Implementado, pendiente PR/QA amplio | `feature/f5-metrics-comparativas`  | Abrir PR apilado despues de F4.                                                     |
| F6 Preferencias notificaciones | Parcial auditado                     | Pendiente                          | Requiere decision canal/proveedor antes de implementacion final.                    |
| F7 Ranking inteligente         | Parcial auditado                     | Pendiente                          | Depende de F4/F5; pesos configurables y ciudad.                                     |
| F8 Patrocinios                 | Parcial auditado                     | Pendiente                          | Definir slots comerciales y orden.                                                  |
| F9 Destacado semanal           | Parcial auditado                     | Pendiente                          | Cerrar fallback/semana Colombia/tests.                                              |

## Cambios activos

- 2026-07-09: creada auditoria global.
- 2026-07-09: iniciado F4 tracking anti-inflado.
- 2026-07-09: F4 implementado con migracion, hash de sesion anonima, dedup por ventana, bot filtering basico y envio automatico de sesion desde frontend.
- 2026-07-09: iniciado F5 metricas con comparativas por KPI y buckets completos.
- 2026-07-09: F5 implementado con RPC summary por metrica, timeseries sin huecos y UI de variacion por KPI.
- 2026-07-09: iniciado F2 microsites con URL corta y slugs reservados.
- 2026-07-09: F2 implementado con ruta `/:slug`, OG corto y migracion de slugs reservados.
- 2026-07-09: iniciado F3 promociones con timezone Colombia y gestion completa.
- 2026-07-09: F3 implementado con normalizacion date-only en `America/Bogota`, endpoint autenticado de gestion, validacion de updates parciales y vistas publicas que ocultan lugares inactivos.
- 2026-07-09: F3 PRs abiertos: backend #25 y frontend #21, apilados sobre F2.

## Evidencia F4

- Backend tests: `npm test -- --runInBand src/modules/metrics/metrics.service.spec.ts src/modules/promotions/promotions.service.spec.ts` -> 2 suites / 26 tests OK.
- Backend build: `npm run build` -> OK.
- Frontend tests: `npm run test:run -- src/features/metrics/__tests__/anonymous-session.test.ts src/features/promotions/__tests__/ads-hero.test.tsx` -> 2 files / 6 tests OK.
- Frontend typecheck: `npm run typecheck` -> OK.
- Frontend lint dirigido de archivos tocados -> OK.
- Backend lint: helper nuevo `interaction-tracking.util.ts` OK; lint dirigido de controllers/services sigue acusando deuda historica de `any` en archivos Supabase/Nest existentes.

## Evidencia F5

- Backend tests: `npm test -- --runInBand src/modules/metrics/metrics.service.spec.ts` -> 1 suite / 9 tests OK.
- Backend build: `npm run build` -> OK.
- Frontend typecheck: `npm run typecheck` -> OK.
- Frontend smoke tests relacionados: `npm run test:run -- src/features/metrics/__tests__/anonymous-session.test.ts src/features/promotions/__tests__/ads-hero.test.tsx` -> OK.

## Evidencia F2

- Backend build: `npm run build` -> OK.
- Frontend typecheck: `npm run typecheck` -> OK.
- Frontend build: `npm run build` -> OK, incluyendo ruta dinamica `/[slug]`.

## Evidencia F3

- Backend tests: `npm test -- --runInBand src/modules/promotions/promotions.service.spec.ts` -> 1 suite / 23 tests OK.
- Backend build: `npm run build` -> OK.
- Backend lint dirigido: `npx eslint src/modules/promotions/promotion-window.util.ts src/modules/promotions/dto/create-promotion.dto.ts` -> OK.
- Frontend tests: `npm run test:run -- src/features/promotions/__tests__/promotion-form.test.tsx` -> 1 file / 2 tests OK.
- Frontend typecheck: `npm run typecheck` -> OK.
- Frontend build: `npm run build` -> OK.
- Frontend lint dirigido: `npx eslint src/features/promotions/api.ts src/features/promotions/hooks/use-promotions.ts src/features/promotions/components/promotion-form.tsx src/features/promotions/__tests__/promotion-form.test.tsx` -> OK.
- PRs: backend <https://github.com/davideliaspalacio/xitty-backend/pull/25>, frontend <https://github.com/davideliaspalacio/xitty-frontend/pull/21>.
