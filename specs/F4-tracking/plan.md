# Plan tecnico - F4 Tracking de eventos

## Checklist

- [x] Migracion SQL para columnas/indices de anti-inflado.
- [x] DTO acepta `anonymous_session_id`.
- [x] Controller pasa headers al service sin exponer PII.
- [x] Service hashea sesion/user-agent, filtra bots, calcula dedup y hace insert idempotente.
- [x] Tests unitarios backend para anon, auth, dedup, bot, 404.
- [x] Frontend genera sesion anonima estable y la envia en cada evento.
- [x] Tests frontend para payload con sesion.
- [x] Lint/build/test enfocados.

## Migracion

Archivo: `supabase/migrations/20260709000001_harden_microsite_interactions.sql`.

Reversible manualmente pero no destructiva:

- Agrega columnas nullable/default.
- Crea indices si no existen.
- Extiende constraint de `interaction_type` para incluir `ad_impression` si el entorno aun no corrio la migracion de hero promos.

## Estrategia de tests

| Criterio | Test |
| --- | --- |
| HU1 sesion anonima | `MetricsService.track` inserta `anonymous_session_hash` y no guarda sesion raw. |
| HU2 auth opcional | Test existente autenticado actualizado con dedup key por user. |
| HU3 dedup | Si Supabase devuelve error unique de `dedup_key`, el service resuelve sin exception. |
| HU4 bot | User-agent bot no llama insert y resuelve 204. |
| HU5 payload invalido | Cubierto por DTO/Nest validation; no se debilita. |
| HU6 compatibilidad | Tests de summary/timeseries existentes siguen pasando. |

## Impacto en features existentes

- Ranking y dashboard siguen leyendo `microsite_interactions`.
- Frontend mantiene el hook `useTrackInteraction`; solo se enriquece payload.
- No cambia visual ni rutas.

## Riesgo

| Tarea | Riesgo | Mitigacion |
| --- | --- | --- |
| Dedup por unique key | Medio | Manejar errores 23505/duplicate como exito. |
| Bot filtering agresivo | Bajo/medio | Lista conservadora de bots conocidos. |
| LocalStorage no disponible | Bajo | Fallback en memoria/random por evento; tracking no bloquea UX. |
| Migracion en entornos viejos | Medio | `IF NOT EXISTS` y constraint extendida compatible. |
