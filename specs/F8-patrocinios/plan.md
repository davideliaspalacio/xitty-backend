# Plan F8 - Posicionamiento patrocinado

## Checklist

- [x] Auditar patrocinio existente.
- [x] Documentar slots/prioridad/vencimiento.
- [x] Agregar migracion de prioridad y expiracion.
- [x] Corregir contrato frontend/backend (`duration_days`).
- [x] Extender patrocinio desde vencimiento vigente.
- [x] Ordenar maximo 3 slots patrocinados sin duplicar organico.
- [x] Ajustar UI de admin/detalle.
- [x] Agregar tests backend/frontend.
- [x] Abrir PRs apilados.

## Migracion SQL

Archivo: `supabase/migrations/20260709000006_harden_sponsored_placements.sql`

- Agrega `places.sponsorship_priority`.
- Agrega `public.expire_sponsorships()`.
- Programa cron horario si `pg_cron` esta disponible.

## Tests

- Backend:
  - activa patrocinio nuevo con prioridad.
  - extiende patrocinio vigente desde `sponsored_until`.
  - solo 3 patrocinados suben al top.
  - expirados no cuentan como patrocinados.
- Frontend:
  - API manda `duration_days` y `priority`.
  - detalle publico oculta sello vencido.

## Riesgos

- Bajo: el ranking organico conserva `position`; patrocinio es overlay de presentacion.
- Medio: si `pg_cron` no esta habilitado, la limpieza del flag queda manual, pero ranking/UI ya verifican `sponsored_until`.

## Evidencia

- Backend: `npm test -- --runInBand src/modules/ranking/ranking.service.spec.ts` -> 1 suite / 13 tests OK.
- Backend: `npm run build` -> OK.
- Backend lint dirigido: `npx eslint src/modules/ranking/ranking.service.ts` -> OK.
- Frontend: `npm run test:run -- src/features/admin/__tests__/api.test.ts src/features/places/__tests__/sponsorship-status.test.ts` -> 2 files / 3 tests OK.
- Frontend: `npm run typecheck` -> OK.
- Frontend: `npm run build` -> OK.
- Backend PR: <https://github.com/davideliaspalacio/xitty-backend/pull/27>.
- Frontend PR: <https://github.com/davideliaspalacio/xitty-frontend/pull/23>.
