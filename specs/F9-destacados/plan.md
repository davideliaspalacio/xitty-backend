# Plan F9 - Contenido destacado semanal

## Checklist

- [x] Auditar destacado semanal existente.
- [x] Documentar fallback y semana Colombia.
- [x] Migracion para ocultar lugares inactivos en `current_featured`.
- [x] Fallback backend cuando no hay destacados vigentes.
- [x] Tests backend de fallback/orden/ocultar inactivos.
- [x] PR apilado.

## Migracion SQL

Archivo: `supabase/migrations/20260709000007_harden_featured_content.sql`

- Reemplaza `current_featured` con join a `places`.
- Mantiene orden `position ASC, created_at DESC`.
- No borra datos.

## Tests

- `findCurrent` devuelve destacados vigentes.
- `findCurrent` usa fallback cuando la view viene vacia.
- `create` rechaza lugares inactivos.

## Riesgos

- Bajo: fallback solo se usa cuando no hay destacados vigentes.

## Evidencia

- Backend: `npm test -- --runInBand src/modules/featured/featured.service.spec.ts` -> 1 suite / 15 tests OK.
- Backend: `npm run build` -> OK.
- Backend PR: <https://github.com/davideliaspalacio/xitty-backend/pull/28>.
