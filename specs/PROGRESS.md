# Progreso SDD - Features v2

Objetivo operativo: avanzar sin gates bloqueantes durante la noche, manteniendo specs, planes, pruebas y trazabilidad por feature.

Runbook de release: `specs/RELEASE_RUNBOOK_FEATURES_V2.md`.
Deuda de lint backend: `specs/LINT_DEBT.md`.

| Feature                        | Estado                               | Rama/PR                            | Proximo paso                                                                        |
| ------------------------------ | ------------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------- |
| F1 Poblacion de lugares        | PRs abiertos, pendiente review/merge | Backend #30 / Backend #31         | Mergear #30 despues de F6 backend #29; luego #31. Aplicar `GOOGLE_MAPS_API_KEY` en backend antes de correr scraper. Fotos/licencias quedan pendientes. |
| F2 Perfil publico URL propia   | PRs abiertos, pendiente review/merge | Backend #24 / Frontend #20         | Mergear despues de F5 backend #23 y frontend #19.                                   |
| F3 Promociones                 | PR abierto, pendiente review/merge   | Backend #25 / Frontend #21         | Mergear despues de F2 backend #24 y frontend #20.                                   |
| F4 Tracking de eventos         | PRs abiertos, pendiente review/merge | Backend #22 / Frontend #18         | Mergear primero desde `main`; base de F5/F2/F3/F7/F8/F6.                            |
| F5 Dashboard metricas          | PRs abiertos, pendiente review/merge | Backend #23 / Frontend #19         | Mergear despues de F4 backend #22 y frontend #18.                                   |
| F6 Preferencias notificaciones | PR abierto, pendiente review/merge   | Backend #29 / Frontend #24         | Mergear despues de F9 backend #28 y F8 frontend #23.                                |
| F7 Ranking inteligente         | PRs abiertos, pendiente review/merge | Backend #26 / Frontend #22 / Backend #32 | Mergear #26/#22 en orden; #32 despues de backend #31 por city/zone.                 |
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
- 2026-07-09: iniciado F1 poblacion de lugares.
- 2026-07-09: F1 avance implementado con proveniencia de fuente, publicacion idempotente por source y reporte SQL de completitud/faltantes.
- 2026-07-09: F1 PR abierto: backend #30.
- 2026-07-09: F1 datos iniciado con seed ampliado de fuentes Cartagena por zonas, sin publicar fotos/lugares automaticamente.
- 2026-07-09: F1 datos PR abierto: backend #31.
- 2026-07-09: F7 gap ciudad implementado: `places.city/zone`, ranking filtrable por ciudad y snapshots city/city_category.
- 2026-07-09: F7 city PR abierto: backend #32.
- 2026-07-09: validacion full frontend en PR #24 tras alinear test de tokens con marca verde actual.
- 2026-07-09: smoke test manual de Google Maps/Places sin exponer secretos: Geocoding, Places Search, Place Details, Nearby Search y descarga de foto via media endpoint respondieron OK.
- 2026-07-09: documentada `GOOGLE_MAPS_API_KEY` en `README.md` backend para evitar que el scraper corra accidentalmente en modo mock.
- 2026-07-09: saneado y versionado `.env.example` backend sin secretos reales, incluyendo `GOOGLE_MAPS_API_KEY`.
- 2026-07-09: cuantificado full lint backend: falla por deuda historica en 118 archivos (2710 errores, 247 warnings); ver `specs/LINT_DEBT.md`.
- 2026-07-09: PR tecnico #33 abierto: `chore/backend-lint-google-places`; Google Places source/spec quedan tipados y con lint dirigido limpio.
- 2026-07-09: PR tecnico #34 abierto: `chore/backend-lint-scraped-items-spec`; `scraped-items.repo.spec.ts` queda con mock Supabase tipado y lint dirigido limpio.
- 2026-07-09: PR tecnico #35 abierto: `chore/backend-lint-scraping-storage-specs`; runs/sources repo specs quedan con mocks Supabase tipados y lint dirigido limpio.
- 2026-07-09: PR tecnico #36 abierto: `chore/backend-lint-scraping-executor-spec`; executor spec queda con mocks tipados y lint dirigido limpio.
- 2026-07-09: PR tecnico #37 abierto: `chore/backend-lint-scraping-admin-spec`; admin scraping spec queda con mocks Supabase/repos tipados y lint dirigido limpio.
- 2026-07-09: PR tecnico #38 abierto: `chore/backend-lint-scraping-runner-spec`; runner legacy spec queda con mocks tipados y lint dirigido limpio.
- 2026-07-09: PR tecnico #39 abierto: `chore/backend-lint-dedup-spec`; dedup service/spec quedan tipados y con lint dirigido limpio.
- 2026-07-09: PR tecnico #40 abierto: `chore/backend-lint-discover-spec`; discover service/spec quedan tipados y con lint dirigido limpio.
- 2026-07-09: PR tecnico #41 abierto: `chore/backend-lint-promotions-spec`; promotions service/spec quedan tipados y con lint dirigido limpio.
- 2026-07-09: PR tecnico #42 abierto: `chore/backend-lint-chat-spec`; chat service/spec quedan tipados y con lint dirigido limpio.
- 2026-07-09: PR tecnico #43 abierto: `chore/backend-lint-reservations-spec`; reservations service/spec quedan tipados y con lint dirigido limpio.
- 2026-07-09: PR tecnico #44 abierto: `chore/backend-lint-experiences-service-spec`; experiences service/spec quedan tipados y con lint dirigido limpio.
- 2026-07-09: PR tecnico #45 abierto: `chore/backend-lint-ranking-spec`; ranking spec queda tipado y con lint dirigido limpio.
- 2026-07-09: PR tecnico #46 abierto: `chore/backend-lint-places-spec`; places service/spec quedan tipados y con lint dirigido limpio.
- 2026-07-09: PR tecnico #47 abierto: `chore/backend-lint-metrics-spec`; metrics spec queda tipado y con lint dirigido limpio.
- 2026-07-09: PR tecnico #48 abierto: `chore/backend-lint-recommendations-service-spec`; recommendations service/spec quedan tipados y con lint dirigido limpio.
- 2026-07-09: PR tecnico #49 abierto: `chore/backend-lint-experience-reviews-service-spec`; experience reviews service/spec quedan tipados y con lint dirigido limpio.
- 2026-07-09: PR tecnico #50 abierto: `chore/backend-lint-favorites-service-spec`; favorites service/spec quedan tipados y con lint dirigido limpio.
- 2026-07-09: PR tecnico #51 abierto: `chore/backend-lint-local-picks-service-spec`; local picks service/spec quedan tipados y con lint dirigido limpio.
- 2026-07-09: PR tecnico #52 abierto: `chore/backend-lint-featured-service-spec`; featured service/spec quedan tipados y con lint dirigido limpio.
- 2026-07-09: PR tecnico #53 abierto: `chore/backend-lint-reviews-service-spec`; reviews service/spec quedan tipados y con lint dirigido limpio.
- 2026-07-09: PR tecnico #54 abierto: `chore/backend-lint-consents-service-spec`; consents service/spec quedan tipados y con lint dirigido limpio.
- 2026-07-09: PR tecnico #55 abierto: `chore/backend-lint-experiences-controller`; experiences controller queda tipado y con lint dirigido limpio.
- 2026-07-09: PR tecnico #56 abierto: `chore/backend-lint-chat-rag-context`; chat RAG context service/spec quedan tipados y con lint dirigido limpio.
- 2026-07-09: PR tecnico #57 abierto: `chore/backend-lint-location-service-spec`; location service/spec quedan tipados y con lint dirigido limpio.
- 2026-07-09: PR tecnico #58 abierto: `chore/backend-lint-chat-controller-spec`; chat controller/spec quedan tipados y con lint dirigido limpio.
- 2026-07-09: PR tecnico #59 abierto: `chore/backend-lint-suggestions-service-spec`; suggestions service/spec quedan tipados y con lint dirigido limpio.
- 2026-07-09: PR tecnico #60 abierto: `chore/backend-lint-notification-settings-service-spec`; notification settings service/spec quedan tipados y con lint dirigido limpio.
- 2026-07-09: PR tecnico #61 abierto: `chore/backend-lint-tavily-search-source-spec`; Tavily source/spec quedan tipados y con lint dirigido limpio.
- 2026-07-09: PR tecnico #62 abierto: `chore/backend-lint-auth-service`; auth service queda tipado y con lint dirigido limpio.
- 2026-07-09: PR tecnico #63 abierto: `chore/backend-lint-photo-storage-service-spec`; photo storage service/spec quedan tipados y con lint dirigido limpio.
- 2026-07-09: PR tecnico #64 abierto: `chore/backend-lint-metrics-controller`; metrics controller queda tipado y con lint dirigido limpio.
- 2026-07-09: PR tecnico #65 abierto: `chore/backend-lint-eventbrite-source-spec`; Eventbrite source/spec quedan tipados y con lint dirigido limpio.
- 2026-07-09: PR tecnico #66 abierto: `chore/backend-lint-promotions-controller`; promotions controller queda tipado y con lint dirigido limpio.
- 2026-07-09: PR tecnico #67 abierto: `chore/backend-lint-places-controller`; places controller queda tipado y con lint dirigido limpio.

## Evidencia transversal

- Backend full suite tras F7 city: `npm test -- --runInBand` -> 38 suites / 474 tests OK.
- Backend build tras F7 city: `npm run build` -> OK.
- Frontend full suite tras correccion de tokens verdes en PR #24: `npm run test:run` -> 41 files / 207 tests OK.
- Frontend typecheck tras correccion de tokens verdes en PR #24: `npm run typecheck` -> OK.
- Frontend build tras correccion de tokens verdes en PR #24: `npm run build` -> OK.
- Frontend lint tras README flags y limpieza e2e: `npm run lint` -> OK, 0 warnings.
- Backend lint Google Places: `npx eslint src/modules/scraping/sources/google-places-source.ts src/modules/scraping/sources/google-places-source.spec.ts` -> OK.
- Backend Google Places tests: `npm test -- --runInBand src/modules/scraping/sources/google-places-source.spec.ts` -> 1 suite / 14 tests OK.
- Backend build tras Google Places lint: `npm run build` -> OK.
- Backend scraped-items repo spec lint: `npx eslint src/modules/scraping/storage/scraped-items.repo.spec.ts` -> OK.
- Backend scraped-items repo spec tests: `npm test -- --runInBand src/modules/scraping/storage/scraped-items.repo.spec.ts` -> 1 suite / 20 tests OK.
- Backend build tras scraped-items lint: `npm run build` -> OK.
- Backend storage repo specs lint: `npx eslint src/modules/scraping/storage/scraping-runs.repo.spec.ts src/modules/scraping/storage/scraping-sources.repo.spec.ts` -> OK.
- Backend storage repo specs tests: `npm test -- --runInBand src/modules/scraping/storage/scraping-runs.repo.spec.ts src/modules/scraping/storage/scraping-sources.repo.spec.ts` -> 2 suites / 19 tests OK.
- Backend build tras storage specs lint: `npm run build` -> OK.
- Backend executor spec lint: `npx eslint src/modules/scraping/executor/scraping-executor.service.spec.ts` -> OK.
- Backend executor spec tests: `npm test -- --runInBand src/modules/scraping/executor/scraping-executor.service.spec.ts` -> 1 suite / 8 tests OK.
- Backend build tras executor spec lint: `npm run build` -> OK.
- Backend admin scraping spec lint: `npx eslint src/modules/scraping/admin/admin-scraping.service.spec.ts` -> OK.
- Backend admin scraping spec tests: `npm test -- --runInBand src/modules/scraping/admin/admin-scraping.service.spec.ts` -> 1 suite / 31 tests OK.
- Backend build tras admin scraping spec lint: `npm run build` -> OK.
- Backend runner spec lint: `npx eslint src/modules/scraping/scheduler/runner.service.spec.ts` -> OK.
- Backend runner spec tests: `npm test -- --runInBand src/modules/scraping/scheduler/runner.service.spec.ts` -> 1 suite / 16 tests OK.
- Backend build tras runner spec lint: `npm run build` -> OK.
- Backend dedup lint: `npx eslint src/modules/scraping/enrichment/dedup.service.ts src/modules/scraping/enrichment/dedup.service.spec.ts` -> OK.
- Backend dedup/enrichment tests: `npm test -- --runInBand src/modules/scraping/enrichment/dedup.service.spec.ts src/modules/scraping/enrichment/enrichment.service.spec.ts` -> 2 suites / 29 tests OK.
- Backend build tras dedup lint: `npm run build` -> OK.
- Backend discover lint: `npx eslint src/modules/scraping/public/discover.service.ts src/modules/scraping/public/discover.service.spec.ts` -> OK.
- Backend discover tests: `npm test -- --runInBand src/modules/scraping/public/discover.service.spec.ts` -> 1 suite / 12 tests OK.
- Backend build tras discover lint: `npm run build` -> OK.
- Backend promotions lint: `npx eslint src/modules/promotions/promotions.service.ts src/modules/promotions/promotions.service.spec.ts` -> OK.
- Backend promotions tests: `npm test -- --runInBand src/modules/promotions/promotions.service.spec.ts` -> 1 suite / 23 tests OK.
- Backend build tras promotions lint: `npm run build` -> OK.
- Backend chat lint: `npx eslint src/modules/chat/chat.service.ts src/modules/chat/chat.service.spec.ts` -> OK.
- Backend chat tests: `npm test -- --runInBand src/modules/chat/chat.service.spec.ts` -> 1 suite / 18 tests OK.
- Backend build tras chat lint: `npm run build` -> OK.
- Backend reservations lint: `npx eslint src/modules/experiences/reservations.service.ts src/modules/experiences/reservations.service.spec.ts` -> OK.
- Backend reservations tests: `npm test -- --runInBand src/modules/experiences/reservations.service.spec.ts` -> 1 suite / 13 tests OK.
- Backend build tras reservations lint: `npm run build` -> OK.
- Backend experiences lint: `npx eslint src/modules/experiences/experiences.service.ts src/modules/experiences/experiences.service.spec.ts` -> OK.
- Backend experiences tests: `npm test -- --runInBand src/modules/experiences/experiences.service.spec.ts` -> 1 suite / 12 tests OK.
- Backend build tras experiences lint: `npm run build` -> OK.
- Backend ranking lint: `npx eslint src/modules/ranking/ranking.service.ts src/modules/ranking/ranking.service.spec.ts` -> OK.
- Backend ranking tests: `npm test -- --runInBand src/modules/ranking/ranking.service.spec.ts` -> 1 suite / 14 tests OK.
- Backend build tras ranking lint: `npm run build` -> OK.
- Backend places lint: `npx eslint src/modules/places/places.service.ts src/modules/places/places.service.spec.ts` -> OK.
- Backend places tests: `npm test -- --runInBand src/modules/places/places.service.spec.ts` -> 1 suite / 19 tests OK.
- Backend build tras places lint: `npm run build` -> OK.
- Backend metrics lint: `npx eslint src/modules/metrics/metrics.service.ts src/modules/metrics/metrics.service.spec.ts` -> OK.
- Backend metrics tests: `npm test -- --runInBand src/modules/metrics/metrics.service.spec.ts` -> 1 suite / 12 tests OK.
- Backend build tras metrics lint: `npm run build` -> OK.
- Backend recommendations lint: `npx eslint src/modules/recommendations/recommendations.service.ts src/modules/recommendations/recommendations.service.spec.ts` -> OK.
- Backend recommendations tests: `npm test -- --runInBand src/modules/recommendations/recommendations.service.spec.ts` -> 1 suite / 11 tests OK.
- Backend build tras recommendations lint: `npm run build` -> OK.
- Backend experience reviews lint: `npx eslint src/modules/experiences/experience-reviews.service.ts src/modules/experiences/experience-reviews.service.spec.ts` -> OK.
- Backend experience reviews tests: `npm test -- --runInBand src/modules/experiences/experience-reviews.service.spec.ts` -> 1 suite / 8 tests OK.
- Backend build tras experience reviews lint: `npm run build` -> OK.
- Backend favorites lint: `npx eslint src/modules/favorites/favorites.service.ts src/modules/favorites/favorites.service.spec.ts` -> OK.
- Backend favorites tests: `npm test -- --runInBand src/modules/favorites/favorites.service.spec.ts` -> 1 suite / 5 tests OK.
- Backend build tras favorites lint: `npm run build` -> OK.
- Backend local picks lint: `npx eslint src/modules/local-picks/local-picks.service.ts src/modules/local-picks/local-picks.service.spec.ts` -> OK.
- Backend local picks tests: `npm test -- --runInBand src/modules/local-picks/local-picks.service.spec.ts` -> 1 suite / 11 tests OK.
- Backend build tras local picks lint: `npm run build` -> OK.
- Backend featured lint: `npx eslint src/modules/featured/featured.service.ts src/modules/featured/featured.service.spec.ts` -> OK.
- Backend featured tests: `npm test -- --runInBand src/modules/featured/featured.service.spec.ts` -> 1 suite / 15 tests OK.
- Backend build tras featured lint: `npm run build` -> OK.
- Backend reviews lint: `npx eslint src/modules/reviews/reviews.service.ts src/modules/reviews/reviews.service.spec.ts` -> OK.
- Backend reviews tests: `npm test -- --runInBand src/modules/reviews/reviews.service.spec.ts` -> 1 suite / 8 tests OK.
- Backend build tras reviews lint: `npm run build` -> OK.
- Backend consents lint: `npx eslint src/modules/consents/consents.service.ts src/modules/consents/consents.service.spec.ts` -> OK.
- Backend consents tests: `npm test -- --runInBand src/modules/consents/consents.service.spec.ts` -> 1 suite / 7 tests OK.
- Backend build tras consents lint: `npm run build` -> OK.
- Backend experiences controller lint: `npx eslint src/modules/experiences/experiences.controller.ts` -> OK.
- Backend experiences controller tests: `npm test -- --runInBand src/modules/experiences/experiences.service.spec.ts src/modules/experiences/reservations.service.spec.ts src/modules/experiences/experience-reviews.service.spec.ts` -> 3 suites / 33 tests OK.
- Backend build tras experiences controller lint: `npm run build` -> OK.
- Backend chat RAG context lint: `npx eslint src/modules/chat/rag/context.service.ts src/modules/chat/rag/context.service.spec.ts` -> OK.
- Backend chat RAG context tests: `npm test -- --runInBand src/modules/chat/rag/context.service.spec.ts` -> 1 suite / 16 tests OK.
- Backend build tras chat RAG context lint: `npm run build` -> OK.
- Backend location lint: `npx eslint src/modules/location/location.service.ts src/modules/location/location.service.spec.ts` -> OK.
- Backend location tests: `npm test -- --runInBand src/modules/location/location.service.spec.ts` -> 1 suite / 8 tests OK.
- Backend build tras location lint: `npm run build` -> OK.
- Backend chat controller lint: `npx eslint src/modules/chat/chat.controller.ts src/modules/chat/chat.controller.spec.ts` -> OK.
- Backend chat controller tests: `npm test -- --runInBand src/modules/chat/chat.controller.spec.ts` -> 1 suite / 14 tests OK.
- Backend build tras chat controller lint: `npm run build` -> OK.
- Backend suggestions lint: `npx eslint src/modules/suggestions/suggestions.service.ts src/modules/suggestions/suggestions.service.spec.ts` -> OK.
- Backend suggestions tests: `npm test -- --runInBand src/modules/suggestions/suggestions.service.spec.ts` -> 1 suite / 10 tests OK.
- Backend build tras suggestions lint: `npm run build` -> OK.
- Backend notification settings lint: `npx eslint src/modules/notification-settings/notification-settings.service.ts src/modules/notification-settings/notification-settings.service.spec.ts` -> OK.
- Backend notification settings tests: `npm test -- --runInBand src/modules/notification-settings/notification-settings.service.spec.ts` -> 1 suite / 3 tests OK.
- Backend build tras notification settings lint: `npm run build` -> OK.
- Backend Tavily lint: `npx eslint src/modules/scraping/sources/tavily-search-source.ts src/modules/scraping/sources/tavily-search-source.spec.ts` -> OK.
- Backend Tavily tests: `npm test -- --runInBand src/modules/scraping/sources/tavily-search-source.spec.ts` -> 1 suite / 21 tests OK.
- Backend build tras Tavily lint: `npm run build` -> OK.
- Backend auth service lint: `npx eslint src/modules/auth/auth.service.ts` -> OK.
- Backend auth service tests: no existe spec de `AuthService`/`AuthController` en `src/**/*.spec.ts`; verificado con build.
- Backend build tras auth service lint: `npm run build` -> OK.
- Backend photo storage lint: `npx eslint src/modules/scraping/storage/photo-storage.service.ts src/modules/scraping/storage/photo-storage.service.spec.ts` -> OK.
- Backend photo storage tests: `npm test -- --runInBand src/modules/scraping/storage/photo-storage.service.spec.ts` -> 1 suite / 6 tests OK.
- Backend build tras photo storage lint: `npm run build` -> OK.
- Backend metrics controller lint: `npx eslint src/modules/metrics/metrics.controller.ts` -> OK.
- Backend metrics smoke tests: `npm test -- --runInBand src/modules/metrics/metrics.service.spec.ts` -> 1 suite / 12 tests OK.
- Backend build tras metrics controller lint: `npm run build` -> OK.
- Backend Eventbrite lint: `npx eslint src/modules/scraping/sources/eventbrite-source.ts src/modules/scraping/sources/eventbrite-source.spec.ts` -> OK.
- Backend Eventbrite tests: `npm test -- --runInBand src/modules/scraping/sources/eventbrite-source.spec.ts` -> 1 suite / 17 tests OK.
- Backend build tras Eventbrite lint: `npm run build` -> OK.
- Backend promotions controller lint: `npx eslint src/modules/promotions/promotions.controller.ts` -> OK.
- Backend promotions smoke tests: `npm test -- --runInBand src/modules/promotions/promotions.service.spec.ts` -> 1 suite / 23 tests OK.
- Backend build tras promotions controller lint: `npm run build` -> OK.
- Backend places controller lint: `npx eslint src/modules/places/places.controller.ts` -> OK.
- Backend places smoke tests: `npm test -- --runInBand src/modules/places/places.service.spec.ts` -> 1 suite / 19 tests OK.
- Backend build tras places controller lint: `npm run build` -> OK.
- Backend full lint: `npx eslint "src/**/*.ts"` -> falla por deuda historica restante documentada en `specs/LINT_DEBT.md`; baja a 58 archivos / 209 errores / 49 warnings.
- Google APIs para F1 scraper: `Geocoding API`, `Places API (New) Search`, `Place Details`, `Nearby Search` y `Photo Media` verificados con HTTP 200. Requiere setear `GOOGLE_MAPS_API_KEY` en runtime backend; no se commitean keys.

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
- Backend city tests: `npm test -- --runInBand src/modules/ranking/ranking.service.spec.ts src/modules/scraping/admin/admin-scraping.service.spec.ts src/modules/scraping/executor/scraping-executor.service.spec.ts src/modules/scraping/storage/scraped-items.repo.spec.ts` -> 4 suites / 73 tests OK.
- Backend city build: `npm run build` -> OK.
- Backend city lint dirigido: `npx eslint src/modules/ranking/ranking.service.ts src/modules/ranking/ranking.controller.ts src/modules/ranking/dto/ranking-query.dto.ts src/modules/ranking/dto/ranking-response.dto.ts src/modules/scraping/admin/admin-scraping.service.ts src/modules/scraping/executor/scraping-executor.service.ts src/modules/scraping/storage/scraped-items.repo.ts` -> OK.
- PR city: backend <https://github.com/davideliaspalacio/xitty-backend/pull/32>.

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

## Evidencia F1

- Backend tests: `npm test -- --runInBand src/modules/scraping/admin/admin-scraping.service.spec.ts src/modules/scraping/executor/scraping-executor.service.spec.ts src/modules/scraping/storage/scraped-items.repo.spec.ts` -> 3 suites / 58 tests OK.
- Backend build: `npm run build` -> OK.
- Backend lint dirigido: `npx eslint src/modules/scraping/admin/admin-scraping.service.ts src/modules/scraping/executor/scraping-executor.service.ts src/modules/scraping/storage/scraped-items.repo.ts` -> OK.
- PR: backend <https://github.com/davideliaspalacio/xitty-backend/pull/30>.
- Seed Cartagena: validacion local de 27 configs JSON -> OK.
- Backend build tras seed: `npm run build` -> OK.
- PR datos: backend <https://github.com/davideliaspalacio/xitty-backend/pull/31>.
