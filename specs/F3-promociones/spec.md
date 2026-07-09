# F3 - Sistema de promociones

## Objetivo

Cerrar el sistema de promociones para que los dueños puedan crear, editar, listar y borrar promociones con vigencia confiable en Colombia, y para que turistas solo vean promociones publicas activas dentro de su rango.

## Usuarios afectados

- Turista: ve promociones activas del lugar, del home/hero y de la vista global.
- Dueno de negocio: gestiona todas sus promociones, incluyendo futuras, vencidas e inactivas.
- Admin Xitty: puede gestionar promociones de cualquier lugar.

## Historias y criterios de aceptacion

### US-F3-01 - Crear promocion

Given un dueno autenticado de un lugar, when crea una promocion con titulo, fechas y descuento opcional, then la promocion queda asociada a su lugar y disponible para gestion.

Given un usuario que no es dueno del lugar, when intenta crear una promocion, then recibe 403.

### US-F3-02 - Vigencia publica automatica

Given una promocion activa, when la fecha actual en `America/Bogota` esta entre inicio y fin, then aparece en las vistas publicas.

Given una promocion futura, vencida, inactiva o de un lugar inactivo, when se consulta desde vistas publicas, then no aparece.

### US-F3-03 - Gestion completa del dueno

Given un dueno autenticado, when abre su dashboard de promociones, then ve promociones activas, futuras, vencidas e inactivas de su lugar.

Given un turista o usuario sin token, when intenta usar la vista de gestion, then recibe 401.

### US-F3-04 - Edicion y borrado

Given un dueno o admin, when edita cualquier campo permitido de una promocion existente, then se actualiza si el rango de fechas sigue siendo valido.

Given una promocion vencida, when el dueno la edita, then el sistema lo permite para poder extenderla, corregirla o desactivarla.

## Modelo de datos

Tabla existente `public.promotions`:

- `starts_at timestamptz not null`
- `ends_at timestamptz not null`
- `is_active boolean not null default true`
- `discount_percentage smallint check between 0 and 100`
- `promotions_period_valid check (ends_at > starts_at)`

Cambios:

- Reemplazar vistas publicas para unirse a `places` y exigir `places.is_active = true`.
- Reemplazar policy publica `promotions_select_active` con la misma regla.

## Contratos de API

- `GET /promotions/active?page&limit`: publico, solo promociones activas y de lugares activos.
- `GET /promotions/hero`: publico, solo hero promos activas y de lugares activos.
- `GET /places/:placeId/promotions`: publico, solo promociones activas del lugar.
- `GET /places/:placeId/promotions/manage`: autenticado, devuelve todas las promociones del lugar si el usuario es dueno o admin.
- `POST /places/:placeId/promotions`: autenticado, crea promocion.
- `PATCH /places/:placeId/promotions/:id`: autenticado, edita promocion.
- `DELETE /places/:placeId/promotions/:id`: autenticado, borra promocion.

## Reglas de autorizacion

- Publico solo puede leer promociones activas, vigentes y de lugares activos.
- Dueno solo puede gestionar promociones de sus lugares.
- Admin puede gestionar promociones de cualquier lugar.
- La autorizacion vive en backend y se refuerza en RLS.

## UI/UX

- Dashboard de promociones usa la ruta de gestion autenticada.
- El formulario usa fechas de calendario (`YYYY-MM-DD`) y muestra que se interpretan en horario Colombia.
- Una promocion con el mismo inicio y fin de calendario es valida: empieza 00:00 y termina 23:59:59.999 en Colombia.

## Edge cases

- Timezone: `America/Bogota`; fecha fin `2026-07-09` incluye todo el 9 de julio en Colombia.
- Fecha fin anterior al inicio: se rechaza en create y update, incluyendo updates parciales.
- Promocion vencida: puede editarse desde gestion.
- Negocio desactivado: no aparece publicamente.
- Descuento fuera de 0-100: rechazado por DTO y check de base.
- Descuento nulo: permitido.

## Fuera de alcance

- Promociones pagadas/patrocinadas avanzadas (F8).
- Seeds de promociones reales o demo (requiere definicion de negocio).
- Notificaciones cuando se crea una promocion (F6).

## Decisiones tomadas

- Las fechas date-only se interpretan como dias completos en `America/Bogota`, porque el negocio opera para visitantes en Colombia y no debe depender de la zona del navegador.
- Los timestamps ISO completos se respetan como instantes exactos para compatibilidad con integraciones tecnicas.
- No se usa job para activar/desactivar; la visibilidad se filtra por query/vista.
