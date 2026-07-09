# Progreso SDD - Features v2

Objetivo operativo: avanzar sin gates bloqueantes durante la noche, manteniendo specs, planes, pruebas y trazabilidad por feature.

| Feature | Estado | Rama/PR | Proximo paso |
| --- | --- | --- | --- |
| F1 Poblacion de lugares | Parcial auditado | Pendiente | Esperar politica de fotos/licencias y preparar seed/reporte idempotente. |
| F2 Perfil publico URL propia | Parcial auditado | Pendiente | Spec de slug/OG/rutas y cerrar gaps. |
| F3 Promociones | Parcial auditado | Pendiente | Tests de timezone/edge cases y ajustes si fallan. |
| F4 Tracking de eventos | Implementado, pendiente PR/QA amplio | `feature/f4-tracking-anti-inflado` | Abrir PR coordinado backend/frontend y correr suite amplia si el tiempo lo permite. |
| F5 Dashboard metricas | Parcial auditado | Pendiente | Depende de F4; luego rellenar dias sin eventos. |
| F6 Preferencias notificaciones | Parcial auditado | Pendiente | Requiere decision canal/proveedor antes de implementacion final. |
| F7 Ranking inteligente | Parcial auditado | Pendiente | Depende de F4/F5; pesos configurables y ciudad. |
| F8 Patrocinios | Parcial auditado | Pendiente | Definir slots comerciales y orden. |
| F9 Destacado semanal | Parcial auditado | Pendiente | Cerrar fallback/semana Colombia/tests. |

## Cambios activos

- 2026-07-09: creada auditoria global.
- 2026-07-09: iniciado F4 tracking anti-inflado.
- 2026-07-09: F4 implementado con migracion, hash de sesion anonima, dedup por ventana, bot filtering basico y envio automatico de sesion desde frontend.

## Evidencia F4

- Backend tests: `npm test -- --runInBand src/modules/metrics/metrics.service.spec.ts src/modules/promotions/promotions.service.spec.ts` -> 2 suites / 26 tests OK.
- Backend build: `npm run build` -> OK.
- Frontend tests: `npm run test:run -- src/features/metrics/__tests__/anonymous-session.test.ts src/features/promotions/__tests__/ads-hero.test.tsx` -> 2 files / 6 tests OK.
- Frontend typecheck: `npm run typecheck` -> OK.
- Frontend lint dirigido de archivos tocados -> OK.
- Backend lint: helper nuevo `interaction-tracking.util.ts` OK; lint dirigido de controllers/services sigue acusando deuda historica de `any` en archivos Supabase/Nest existentes.
