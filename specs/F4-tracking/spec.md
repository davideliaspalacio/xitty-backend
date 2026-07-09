# F4 - Tracking de eventos anti-inflado

## Objetivo

Registrar eventos de perfiles/lugares/promociones sin login, sin frenar la UX y con proteccion basica contra inflado accidental o bots simples.

## Usuarios afectados

- Turista anonimo o autenticado: navega perfiles y hace clicks sin notar el tracking.
- Dueno de negocio: ve metricas mas confiables.
- Admin Xitty: usa datos para ranking, promociones y decisiones comerciales.

## Historias y criterios verificables

### HU1 - Evento anonimo con sesion estable

Given un visitante sin login
When abre un perfil o hace click en un CTA
Then el frontend envia un `anonymous_session_id` estable y el backend lo persiste hasheado o no PII.

### HU2 - Evento autenticado opcional

Given un visitante autenticado
When dispara un evento
Then el backend conserva `user_id` si el bearer token es valido y tambien acepta la sesion anonima.

### HU3 - Deduplicacion por ventana

Given la misma sesion dispara el mismo evento para el mismo lugar/promocion varias veces en una ventana corta
When el backend recibe los duplicados
Then solo inserta el primer evento y responde 204 sin romper la UX.

### HU4 - Bot filtering basico

Given un request con user-agent de bot/crawler conocido
When intenta registrar interacciones
Then el backend ignora el evento y responde 204.

### HU5 - Payload malformado

Given un payload con tipo invalido o ids invalidos
When llega al endpoint
Then la validacion responde 400 y nunca genera 500.

### HU6 - Ranking y metricas siguen usando la misma tabla

Given existen dashboards y ranking basados en `microsite_interactions`
When se agrega anti-inflado
Then no se rompe el contrato existente de summary/timeseries/ranking.

## Modelo de datos

Tabla existente: `public.microsite_interactions`.

Campos nuevos:

- `anonymous_session_hash text null`: hash SHA-256 de la sesion anonima o fallback no PII.
- `dedup_key text null`: llave estable `place:event:promo:actor:bucket`.
- `user_agent_hash text null`: hash SHA-256 del user-agent para debug agregado sin guardar texto crudo.
- `metadata jsonb not null default '{}'`: espacio controlado para version/canal futuro.

Indices:

- `microsite_interactions_dedup_key_recent_uidx` unique sobre `dedup_key` cuando no es null.
- `microsite_interactions_actor_date_idx` sobre `place_id, anonymous_session_hash, created_at desc`.

## Contrato API

Endpoint existente:

`POST /places/:placeId/interactions`

Request:

```json
{
  "interaction_type": "profile_view",
  "promo_id": "uuid opcional",
  "anonymous_session_id": "string opcional"
}
```

Response:

- 204: registrado o ignorado de forma segura.
- 400: payload invalido.
- 404: place no existe o no esta activo.

## Autorizacion

- Insert publico permitido.
- Si hay bearer token valido, se guarda `user_id`.
- Lectura de metricas sigue protegida a owner/admin.
- No se guarda IP ni PII. La sesion se hashea en backend.

## UI/UX

- El frontend genera/lee una sesion anonima en `localStorage`.
- El tracking sigue fire-and-forget y los errores se silencian.
- CTAs existentes no cambian visualmente.

## Edge cases cubiertos

- Doble click en CTA: se deduplica.
- Recarga repetida: `profile_view` se deduplica por ventana.
- Evento sobre lugar eliminado/inactivo: 404.
- Promo eliminada: `promo_id` queda nullable; la FK ya usa `ON DELETE SET NULL`.
- Bot/crawler obvio: se ignora.
- Payload invalido: 400 por DTO.

## Fuera de alcance

- Fingerprinting avanzado.
- Captura de IP.
- Anti-fraude comercial sofisticado.
- Cola asincrona o proveedor externo de analytics.

## Decisiones

- Ventana de dedup inicial: 10 minutos para `profile_view` y 2 minutos para clicks/impresiones.
- Actor de dedup: `user_id` si existe; si no, `anonymous_session_hash`.
- Si no llega sesion anonima, se usa un actor fallback por request limitado a user-agent hash, suficiente para no romper pero menos fuerte.
