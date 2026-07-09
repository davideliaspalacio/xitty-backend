# F9 - Contenido destacado semanal

## Objetivo

Garantizar destacados semanales curados, programables y con fallback para que el home no quede vacio cuando no haya contenido editorial cargado.

## Criterios de aceptacion

- Admin crea destacados con lugar, foto/texto editorial y credito.
- Se pueden programar semanas futuras con `week_starts_at` / `week_ends_at`.
- `GET /featured/current` devuelve los destacados vigentes ordenados por `position`.
- Si no hay destacados vigentes, devuelve fallback de lugares activos mejor calificados.
- Lugares desactivados no aparecen aunque tengan destacado vigente.
- Se permiten varios destacados en la misma semana, ordenados por `position` y `created_at`.

## Semana y timezone

- Semana de producto: lunes 00:00 a domingo 23:59:59.999 en `America/Bogota`.
- El fallback calcula la semana actual con offset Colombia (UTC-05, sin DST).

## Modelo de datos

Tabla existente `featured_content`:

- `place_id`
- `curator_name`
- `custom_title`
- `custom_description`
- `hero_image_url`
- `week_starts_at`
- `week_ends_at`
- `position`
- `is_active`

Cambios:

- Reemplazar view `current_featured` para unir `places` y exigir `places.is_active = true`.

## API

- `GET /featured/current`: publico, devuelve destacados vigentes o fallback.
- `GET /featured`: historial paginado.
- `POST/PATCH/DELETE /admin/featured`: admin.

## Edge cases

- Semana sin contenido: fallback a lugares activos mejor calificados.
- Lugar destacado desactivado: se oculta.
- Varios destacados en la semana: orden estable por `position`, luego `created_at DESC`.
- Fechas invalidas: se rechaza `week_ends_at <= week_starts_at`.

## Fuera de alcance

- UI admin avanzada para destacados.
- Workflow de aprobacion con influencers.
