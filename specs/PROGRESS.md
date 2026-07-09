# Progreso SDD - Features v2

Objetivo operativo: avanzar sin gates bloqueantes durante la noche, manteniendo specs, planes, pruebas y trazabilidad por feature.

| Feature                        | Estado                               | Rama/PR                            | Proximo paso                                                                        |
| ------------------------------ | ------------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------- |
| F1 Poblacion de lugares        | Parcial auditado                     | Pendiente                          | Esperar politica de fotos/licencias y preparar seed/reporte idempotente.            |
| F2 Perfil publico URL propia   | Implementado, pendiente PR/QA amplio | `feature/f2-public-slugs-og`       | Abrir PR apilado despues de F5.                                                     |
| F3 Promociones                 | PR abierto, pendiente review/merge   | Backend #25 / Frontend #21         | Mergear despues de F2 backend #24 y frontend #20.                                   |
| F4 Tracking de eventos         | Implementado, pendiente PR/QA amplio | `feature/f4-tracking-anti-inflado` | Abrir PR coordinado backend/frontend y correr suite amplia si el tiempo lo permite. |
| F5 Dashboard metricas          | Implementado, pendiente PR/QA amplio | `feature/f5-metrics-comparativas`  | Abrir PR apilado despues de F4.                                                     |
| F6 Preferencias notificaciones | PR abierto, pendiente review/merge   | Backend #29 / Frontend #24         | Mergear despues de F9 backend #28 y F8 frontend #23.                                |
| F7 Ranking inteligente         | PR abierto, pendiente review/merge   | Backend #26 / Frontend #22         | Mergear despues de F3 backend #25 y frontend #21.                                   |
| F8 Patrocinios                 | PR abierto, pendiente review/merge   | Backend #27 / Frontend #23         | Mergear despues de F7 backend #26 y frontend #22.                                   |
| F9 Destacado semanal           | PR abierto, pendiente review/merge   | Backend #28                        | Mergear despues de F8 backend #27.                                                  |

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
- 2026-07-09: iniciado F7 ranking inteligente.
- 2026-07-09: F7 implementado con pesos configurables, score bayesiano, ranking global/categoria, snapshots por scope y delta semanal visible en UI.
- 2026-07-09: F7 PRs abiertos: backend #26 y frontend #22, apilados sobre F3.
- 2026-07-09: iniciado F8 patrocinios.
- 2026-07-09: F8 implementado con prioridad de slots, maximo 3 destacados, extension segura, limpieza de vencidos y contrato frontend/backend corregido.
- 2026-07-09: F8 PRs abiertos: backend #27 y frontend #23, apilados sobre F7.
- 2026-07-09: iniciado F9 destacado semanal.
- 2026-07-09: F9 implementado con view que oculta lugares inactivos y fallback semanal de lugares activos mejor calificados.
- 2026-07-09: F9 PR abierto: backend #28, apilado sobre F8.
- 2026-07-09: iniciado F6 preferencias de notificaciones.
- 2026-07-09: F6 implementado con outbox neutral, resumen diario programable y tracking que respeta preferencias sin depender aun de proveedor email/push/WhatsApp.
- 2026-07-09: F6 PRs abiertos: backend #29 y frontend #24.

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

## Evidencia F7

- Backend tests: `npm test -- --runInBand src/modules/ranking/ranking.service.spec.ts` -> 1 suite / 11 tests OK.
- Backend build: `npm run build` -> OK.
- Backend lint dirigido: `npx eslint src/modules/ranking/ranking.service.ts` -> OK.
- Frontend tests: `npm run test:run -- src/features/discover/__tests__/ranking-card.test.tsx` -> 1 file / 3 tests OK.
- Frontend typecheck: `npm run typecheck` -> OK.
- Frontend build: `npm run build` -> OK.
- PRs: backend <https://github.com/davideliaspalacio/xitty-backend/pull/26>, frontend <https://github.com/davideliaspalacio/xitty-frontend/pull/22>.

## Evidencia F8

- Backend tests: `npm test -- --runInBand src/modules/ranking/ranking.service.spec.ts` -> 1 suite / 13 tests OK.
- Backend build: `npm run build` -> OK.
- Backend lint dirigido: `npx eslint src/modules/ranking/ranking.service.ts` -> OK.
- Frontend tests: `npm run test:run -- src/features/admin/__tests__/api.test.ts src/features/places/__tests__/sponsorship-status.test.ts` -> 2 files / 3 tests OK.
- Frontend typecheck: `npm run typecheck` -> OK.
- Frontend build: `npm run build` -> OK.
- PRs: backend <https://github.com/davideliaspalacio/xitty-backend/pull/27>, frontend <https://github.com/davideliaspalacio/xitty-frontend/pull/23>.

## Evidencia F9

- Backend tests: `npm test -- --runInBand src/modules/featured/featured.service.spec.ts` -> 1 suite / 15 tests OK.
- Backend build: `npm run build` -> OK.
- PR: backend <https://github.com/davideliaspalacio/xitty-backend/pull/28>.

## Evidencia F6

- Backend tests: `npm test -- --runInBand src/modules/metrics/metrics.service.spec.ts src/modules/notification-settings/notification-settings.service.spec.ts` -> 2 suites / 15 tests OK.
- Backend build: `npm run build` -> OK.
- Backend lint dirigido: `npx eslint src/modules/metrics/metrics.service.ts` -> OK.
- Frontend typecheck: `npm run typecheck` -> OK.
- Frontend build: `npm run build` -> OK.
- Frontend lint dirigido: `npx eslint 'src/app/(app)/dashboard/settings/page.tsx'` -> OK.
- PRs: backend <https://github.com/davideliaspalacio/xitty-backend/pull/29>, frontend <https://github.com/davideliaspalacio/xitty-frontend/pull/24>.
