# Plan tecnico - F5 metricas

## Checklist

- [x] Reemplazar RPC summary con comparativa por metrica.
- [x] Reemplazar RPC timeseries para generar buckets completos en dia/semana.
- [x] Actualizar DTO backend y normalizacion numerica.
- [x] Actualizar tipos frontend.
- [x] Mostrar cambio porcentual en cada KPI.
- [x] Ajustar tests unitarios de metrics service.
- [x] Ejecutar tests/typecheck/build enfocados.

## Migracion

Archivo: `supabase/migrations/20260709000002_improve_metrics_summary_timeseries.sql`.

Es no destructiva de datos, pero reemplaza funciones RPC. `place_metrics_summary` se dropea y recrea porque Postgres no permite cambiar el return type con `CREATE OR REPLACE`.

## Estrategia de tests

| Criterio | Test                                                                                   |
| -------- | -------------------------------------------------------------------------------------- |
| HU2/HU3  | `MetricsService.getSummary` castea los nuevos campos por metrica.                      |
| HU4/HU5  | SQL usa `generate_series`; validacion por revision de migracion y smoke futuro con DB. |
| HU6      | Tests existentes de owner/admin/no-owner se mantienen.                                 |

## Riesgos

| Riesgo                               | Mitigacion                                         |
| ------------------------------------ | -------------------------------------------------- |
| Cambio de return type RPC            | DTO/service/frontend se actualizan en el mismo PR. |
| Rangos largos generan muchos buckets | UI usa semana para >60 dias; RPC solo dia/semana.  |
