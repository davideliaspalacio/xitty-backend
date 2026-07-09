# F8 - Posicionamiento patrocinado

## Objetivo

Dejar listo el posicionamiento patrocinado para venta: activacion manual por admin, vencimiento automatico, sello visible y slots destacados sin alterar el ranking organico.

## Historias y criterios de aceptacion

### US-F8-01 - Activar o extender patrocinio

Given un admin Xitty, when activa patrocinio con duracion y prioridad, then el lugar queda patrocinado hasta la fecha calculada.

Given un lugar ya patrocinado vigente, when el admin activa mas dias, then se extiende desde el vencimiento actual y no se acorta accidentalmente.

### US-F8-02 - Cancelar patrocinio

Given un patrocinio vigente, when el admin lo cancela, then deja de aparecer como patrocinado.

### US-F8-03 - Slots patrocinados transparentes

Given hay lugares patrocinados vigentes, when se consulta ranking, then maximo 3 aparecen arriba con sello `Patrocinado`, ordenados por prioridad, vencimiento y score.

Given un lugar patrocinado tambien esta en top organico, when se renderiza el ranking, then aparece una sola vez.

### US-F8-04 - Vencimiento automatico

Given un patrocinio vencido, when pasa su fecha de fin, then no aparece como patrocinado aunque el flag historico no se haya limpiado todavia.

## Modelo de datos

- `places.is_sponsored`
- `places.sponsored_at`
- `places.sponsored_until`
- `places.sponsorship_priority` nuevo, 0-100.

Funciones:

- `public.expire_sponsorships()` limpia patrocinios vencidos.
- Cron opcional `expire-sponsorships-hourly` si `pg_cron` esta habilitado.

## API

- `POST /admin/places/:placeId/sponsorship`
  - body: `{ duration_days: number, priority?: number }`
  - admin only
- `DELETE /admin/places/:placeId/sponsorship`
  - admin only

## UI/UX

- Admin puede activar patrocinio indicando dias y prioridad.
- El estado visual distingue vigente, vencido e inactivo.
- En ranking y detalle publico el sello solo aparece si el patrocinio esta vigente.

## Edge cases

- Mas patrocinados que slots: se toman maximo 3 por prioridad desc, vencimiento desc, score desc.
- Vence a medianoche/timezone: se calcula por instantes UTC; la UI muestra fecha local `es-CO`.
- Patrocinado + top organico: no se duplica.
- Lugar desactivado: no entra al ranking materializado.

## Fuera de alcance

- Pagos/cobros.
- Facturacion.
- UI historica avanzada de campanas.
