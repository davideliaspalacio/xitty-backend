# Plan F6 - Preferencias de notificaciones

## Checklist

- [x] Auditar preferencias existentes y TODO de tracking.
- [x] Documentar cierre de gap con outbox neutral.
- [x] Agregar migracion de `business_notification_outbox`.
- [x] Agregar funcion/job diario de resumen.
- [x] Encolar avisos desde tracking respetando preferencias.
- [x] Ajustar copy frontend para no prometer canal no definido.
- [x] Correr tests, build y lint dirigido.
- [x] Abrir PRs apilados.

## Migracion SQL

Archivo: `supabase/migrations/20260709000008_create_notification_outbox.sql`

- Crea `business_notification_outbox`.
- Agrega indice unico por `dedup_key` para evitar duplicados.
- Agrega RLS de lectura por dueno/admin.
- Agrega `public.enqueue_daily_business_summaries(p_for_date date)`.
- Programa cron diario a las 12:00 UTC si `pg_cron` esta disponible.

## Tests

- Backend:
  - click con preferencia activa encola aviso.
  - click con preferencia apagada no encola.
  - negocio sin dueno no encola.
  - fallo de outbox no rompe tracking.
  - dedup del tracking evita encolar eventos duplicados.
- Frontend:
  - typecheck/build cubren que la pantalla de settings siga renderizando con los toggles existentes.

## Riesgos

- Bajo: no cambia el contrato publico de tracking ni settings.
- Medio: el envio real depende de decision futura de canal/proveedor; por eso se deja `channel = pending`.
- Bajo: si `pg_cron` no esta habilitado, la funcion diaria queda disponible para correr manualmente o desde scheduler externo.

## Evidencia

- Backend: `npm test -- --runInBand src/modules/metrics/metrics.service.spec.ts src/modules/notification-settings/notification-settings.service.spec.ts` -> 2 suites / 15 tests OK.
- Backend: `npm run build` -> OK.
- Backend lint dirigido: `npx eslint src/modules/metrics/metrics.service.ts` -> OK.
- Frontend: `npm run typecheck` -> OK.
- Frontend: `npm run build` -> OK.
- Frontend lint dirigido: `npx eslint 'src/app/(app)/dashboard/settings/page.tsx'` -> OK.
- Backend PR: <https://github.com/davideliaspalacio/xitty-backend/pull/29>.
- Frontend PR: <https://github.com/davideliaspalacio/xitty-frontend/pull/24>.
