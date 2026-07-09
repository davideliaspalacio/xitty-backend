# Auditoria global - Xitty Features v2

Estado revisado el 2026-07-09 desde `main` actualizado de:

- Backend: NestJS + Supabase/Postgres, migraciones en `supabase/migrations`, seeds/scripts en `supabase/seed` y `scripts`.
- Frontend: Next.js 16 + React 19, App Router, TanStack Query, Zustand, Recharts, lucide-react.

Nota: `README.md` de backend esta desactualizado porque afirma que solo existe auth. La fuente real es `src/app.module.ts`, las migraciones y los modulos cargados.

## Stack y patrones encontrados

| Area | Evidencia | Estado |
| --- | --- | --- |
| Backend | `src/app.module.ts` importa Auth, Places, Microsites, Promotions, Metrics, Ranking, Featured, Experiences, Scraping, Chat, AudioTours, etc. | Modular NestJS sobre Supabase service-role. |
| DB/migraciones | `supabase/migrations/*.sql` | SQL versionado con RLS en tablas nuevas. |
| Auth | `src/modules/auth`, `src/common/guards/auth.guard.ts`, `20260408000001_reset_auth_schema.sql` | JWT propio + roles `user/business/admin`. |
| Places | `src/modules/places`, `20260413000001_create_categories_and_places.sql` | Lugares/categorias/fotos, owner, RLS. |
| Microsites | `src/modules/microsites`, `20260420000001_extend_places_for_microsites.sql`, frontend `src/app/microsites/[slug]/page.tsx` | URL publica por slug bajo `/microsites/:slug`. |
| Promos | `src/modules/promotions`, `20260420000002_create_promotions.sql`, frontend dashboard/promos | CRUD y vistas activas por fecha. |
| Tracking/metricas | `src/modules/metrics`, `20260420000003_create_microsite_interactions.sql`, frontend `features/metrics` | Parcial: eventos existen, falta anti-inflado serio. |
| Ranking | `src/modules/ranking`, `20260427000001_create_place_rankings.sql` | Materialized view + snapshots + refresh admin/cron condicional. |
| Patrocinios | `src/modules/ranking`, `20260427000003_extend_places_for_sponsorship.sql`, frontend admin sponsorships | Parcial: columnas y admin endpoints, sin slots comerciales configurables. |
| Destacados | `src/modules/featured`, `20260427000002_create_featured_content.sql` | Parcial: programacion por semana via fechas, admin CRUD. |
| Scraping/datos | `src/modules/scraping`, `20260619000001_create_scraping_tables.sql`, `20260701000002_seed_cartagena_sources.sql` | Pipeline y fuentes Cartagena existen; carga final depende de correr scraper/moderar/publicar. |
| Audio tours | `src/modules/audio-tours`, `20260706000001_create_audio_tours.sql`, frontend `features/audio-tours` | Existe MVP con piloto Castillo de Salgar. |
| Feature flags | Frontend `src/lib/feature-flags.ts` | Existe para secciones/funcionalidades. |

## Como se cargo contenido

| Mecanismo | Evidencia | Observacion |
| --- | --- | --- |
| Seed SQL grande | `supabase/seed/full-seed.sql`, `full-seed-v2.sql` | Poblacion demo de Barranquilla; `full-seed.sql` avisa que algunas secciones pueden duplicar si se re-ejecuta. |
| Seed TS de places | `scripts/seed-places.ts` | Idempotente por nombre; usa fotos externas de Unsplash; orientado a Barranquilla. |
| Seed discover | `scripts/seed-discover.ts` | Idempotente para semana actual; refresca ranking y crea featured/local picks. |
| Fuentes Cartagena | `supabase/migrations/20260701000002_seed_cartagena_sources.sql` | Idempotente por `scraping_sources.name`; usa Google Places/Eventbrite como fuentes. |
| Scraper + moderacion | `src/modules/scraping/admin/admin-scraping.service.ts` | Admin corre source, revisa items y publica a `places` o `experiences`. |

## Estado por feature

| Feature | Estado | Evidencia | Gap principal |
| --- | --- | --- | --- |
| F1 Poblacion de lugares | Parcial | `scripts/seed-places.ts`, `supabase/seed/full-seed*.sql`, `20260701000002_seed_cartagena_sources.sql`, `src/modules/scraping` | No hay seed final idempotente para nueva ciudad/lote real aprobado; fotos de Google requieren politica/licencia; el full seed no es totalmente idempotente. |
| F2 Perfil publico URL propia | Parcial | `20260420000001_extend_places_for_microsites.sql`, `src/modules/microsites`, `src/app/microsites/[slug]/page.tsx`, CTAs en `features/microsites` | URL vive bajo `/microsites/:slug`, no `/:slug`; faltan slugs reservados/race condition robusta y metadata OG especifica del microsite en Next. |
| F3 Promociones | Parcial/alto avance | `20260420000002_create_promotions.sql`, `src/modules/promotions`, dashboard frontend | CRUD/fechas/autorizacion existen; falta cerrar timezone Colombia en spec/tests e incluir edge cases completos. |
| F4 Tracking de eventos | Parcial | `microsite_interactions`, `MetricsService.track`, `useTrackInteraction`, CTAs frontend | Falta session anonima persistente, deduplicacion por ventana, bot filtering basico e indices para session/evento. |
| F5 Dashboard metricas | Parcial | RPCs `place_metrics_summary/timeseries`, `src/app/(app)/dashboard/metrics/page.tsx` | Hay comparativa y grafica, pero timeseries no rellena dias sin eventos y depende de que F4 no infle datos. |
| F6 Preferencias notificaciones | Parcial bajo | `business_notification_settings`, `src/modules/notification-settings`, dashboard settings | Solo guarda toggles; no existe proveedor/canal, dispatch ni job de resumen diario. |
| F7 Ranking inteligente | Parcial | `place_rankings`, `refresh_place_rankings`, `src/modules/ranking` | Formula existe fija; faltan pesos configurables, normalizacion mas robusta, ciudad y manejo transaccional de refresh/snapshots. |
| F8 Posicionamiento patrocinado | Parcial | `is_sponsored/sponsored_until`, endpoints `admin/places/:id/sponsorship`, UI admin | Falta modelo de slots, orden comercial configurable y vencimiento/duplicados definidos mas alla de promoted sort. |
| F9 Destacado semanal | Parcial | `featured_content`, `current_featured`, admin CRUD, frontend home | Programacion por fecha existe; falta fallback formal cuando no hay semana, definicion lunes-domingo Colombia y tests completos. |

## Orden de ejecucion recomendado

1. F4 Tracking anti-inflado: desbloquea metricas y ranking confiables.
2. F5 Metricas: corregir dias en cero y comparativa robusta.
3. F2 Microsites: cerrar URL/OG/slug reservado porque es la superficie comercial compartible.
4. F3 Promos: cerrar timezone/tests/edge cases y hero ads.
5. F7 Ranking: pesos configurables + ciudad + snapshot seguro.
6. F8 Patrocinios: slots y panel comercial.
7. F9 Destacados: fallback y semana Bogota.
8. F1 Datos: correr scraper real y preparar seeds/reportes, despues de confirmar licencias.
9. F6 Notificaciones: requiere decidir canal/proveedor.

## Riesgos y preguntas de negocio pendientes

1. Fotos: confirmar fuente legal permitida para fotos permanentes. Recomendacion: rehost solo assets con licencia clara o fotos propias; Google se usa con cautela y atribucion.
2. Notificaciones: definir canal/proveedor. Recomendacion: empezar con email transaccional + resumen diario; WhatsApp queda para fase comercial por costo/opt-in.
3. Slug al renombrar negocio: recomendacion tecnica/producto: slug estable y redirects historicos para no romper links.
4. Patrocinios: definir cantidad de slots por listado. Recomendacion inicial: 2 slots por listado, ordenados por prioridad manual y fecha de vencimiento.
5. Promos de arranque: confirmar si son reales o demo. Recomendacion: demo visible solo en ambiente staging/dev; produccion solo reales.
