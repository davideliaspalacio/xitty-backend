# Plan F3 - Sistema de promociones

## Checklist

- [x] Auditar promociones existentes.
- [x] Especificar regla de timezone `America/Bogota`.
- [x] Agregar endpoint autenticado de gestion.
- [x] Normalizar fechas date-only en backend.
- [x] Endurecer validacion de update parcial.
- [x] Ajustar vistas/RLS para ocultar promos de lugares inactivos.
- [x] Ajustar dashboard para usar gestion autenticada.
- [x] Agregar tests unitarios/backend y frontend.
- [x] Abrir PRs apilados.

## Migracion SQL

Archivo: `supabase/migrations/20260709000004_harden_promotions_public_visibility.sql`

- Reemplaza `public.active_promotions`.
- Reemplaza `public.active_hero_promotions`.
- Reemplaza policy `promotions_select_active`.
- No borra datos. Es reversible recreando las vistas/policy anteriores.

## Estrategia de tests

- `PromotionsService.create`:
  - date-only se normaliza a inicio/fin de dia Colombia.
  - misma fecha de inicio/fin es valida.
  - fin anterior a inicio se rechaza.
- `PromotionsService.update`:
  - update parcial valida contra la promocion existente.
  - promo vencida puede editarse.
  - 404 si no existe.
- `PromotionsService.findManageByPlace`:
  - dueno/admin pueden listar todas las promos del lugar.
  - usuario ajeno recibe 403 por `assertOwnership`.
- Frontend `PromotionForm`:
  - envia `YYYY-MM-DD` sin convertir por timezone del navegador.
  - permite promocion de un solo dia.

## Impacto

- Publico mantiene mismas rutas y shapes.
- Dashboard cambia a ruta autenticada para poder ver futuras/vencidas/inactivas.
- Las promos creadas desde integraciones con timestamps completos siguen funcionando.

## Riesgos

- Bajo: `America/Bogota` no tiene DST, por eso la normalizacion con UTC-05 fijo es estable.
- Medio: clientes externos que enviaban date-only esperando UTC ahora obtendran semantica de negocio Colombia. Se documenta como decision de producto.

## Evidencia

- Backend: `npm test -- --runInBand src/modules/promotions/promotions.service.spec.ts` -> 1 suite / 23 tests OK.
- Backend: `npm run build` -> OK.
- Frontend: `npm run test:run -- src/features/promotions/__tests__/promotion-form.test.tsx` -> 1 file / 2 tests OK.
- Frontend: `npm run typecheck` -> OK.
- Frontend: `npm run build` -> OK.
- Backend PR: <https://github.com/davideliaspalacio/xitty-backend/pull/25>.
- Frontend PR: <https://github.com/davideliaspalacio/xitty-frontend/pull/21>.
