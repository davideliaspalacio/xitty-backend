# F6 - Preferencias de notificaciones

## Objetivo

Cerrar el gap de F6: las preferencias de notificaciones ya se pueden guardar, pero el sistema aun no las respetaba al registrar interacciones. Esta fase agrega una cola interna de avisos lista para conectar a email, push o WhatsApp cuando se defina el proveedor.

## Historias y criterios de aceptacion

### US-F6-01 - Guardar preferencias por dueno

Given un dueno autenticado, when abre ajustes de notificaciones, then ve sus preferencias guardadas o defaults seguros.

Given un dueno autenticado, when cambia un toggle, then la preferencia queda persistida para su usuario.

### US-F6-02 - Respetar preferencias en clicks relevantes

Given un turista hace click en `Llamar`, `WhatsApp` o `Reservar`, when el negocio tiene dueno y la preferencia correspondiente esta activa, then se encola un aviso para ese dueno.

Given la preferencia correspondiente esta apagada, when ocurre el click, then no se encola ningun aviso.

Given el dueno tiene todo apagado, when ocurren clicks relevantes, then no recibe absolutamente nada nuevo en la cola.

### US-F6-03 - Resumen diario

Given un dueno tiene `daily_summary` activo y hubo eventos el dia anterior, when corre el job diario, then se encola un resumen por negocio con los conteos del dia.

Given no hubo eventos el dia anterior, when corre el job diario, then se omite el resumen para no generar ruido.

Given un dueno tiene varios negocios, when corre el job, then se genera un resumen separado por negocio con actividad.

### US-F6-04 - Tolerancia a fallos

Given la cola de notificaciones falla, when se registra una interaccion, then el tracking no falla hacia el turista.

Given una notificacion ya fue encolada para la misma interaccion o resumen, when se reintenta, then no se duplica.

## Modelo de datos

- `business_notification_settings`: ya existente, preferencias por usuario.
- `business_notification_outbox`: nueva tabla de cola:
  - `recipient_user_id`
  - `place_id`
  - `interaction_id`
  - `notification_type`
  - `channel`
  - `status`
  - `dedup_key`
  - `payload`
  - `scheduled_for`, `sent_at`, `error_message`

## API

Se mantiene la API existente:

- `GET /me/notification-settings`
- `PATCH /me/notification-settings`
- `POST /places/:placeId/interactions`

El endpoint de tracking ahora encola avisos en segundo plano cuando aplica.

## Reglas de autorizacion

- Solo roles `business` y `admin` gestionan sus preferencias desde la API.
- La cola queda protegida por RLS: el dueno puede seleccionar sus avisos y admin puede verlos todos.
- Las inserciones las hace el backend con service role o el job SQL.

## UI/UX

- Dashboard settings conserva toggles existentes.
- La copia evita prometer `push/email` porque el canal final aun no esta definido.

## Edge cases

- Todo apagado: no se encolan avisos ni resumen.
- Dia sin eventos: no se encola resumen.
- Dueno con varios negocios: resumen por negocio.
- Preferencia cambiada con notificacion ya encolada: no se reescriben items historicos; las preferencias nuevas aplican a los siguientes eventos o siguientes corridas del resumen.
- Fallo del proveedor/cola: tracking sigue respondiendo normal.

## Fuera de alcance

- Envio real por email, push o WhatsApp.
- Seleccion de proveedor.
- Pantalla de historial de notificaciones.
