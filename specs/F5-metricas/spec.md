# F5 - Dashboard de metricas para duenos

## Objetivo

Mejorar el dashboard de metricas para que muestre totales por evento, comparativa por metrica contra el periodo anterior y una grafica sin huecos para dias/semanas sin actividad.

## Usuarios afectados

- Dueno de negocio: entiende rendimiento del perfil/promos/CTAs.
- Admin Xitty: puede revisar metricas de cualquier negocio.

## Historias y criterios verificables

### HU1 - Totales por tipo

Given un dueno selecciona 7, 30 o 90 dias
When abre metricas
Then ve totales de vistas, llamadas, WhatsApp, reservas, como llegar y vistas de promo.

### HU2 - Comparativa por metrica

Given hay datos en el periodo actual y anterior
When el backend responde el summary
Then incluye porcentaje de cambio por cada metrica y el total.

### HU3 - Periodo anterior sin datos

Given el periodo anterior tiene cero interacciones
When el periodo actual tiene actividad
Then el cambio se reporta como `100` en vez de dividir por cero.

### HU4 - Negocio nuevo sin datos

Given no hay interacciones en el rango
When se consulta la serie
Then la grafica recibe buckets con cero, no un array vacio por falta de filas.

### HU5 - Dias sin eventos

Given hay eventos en algunos dias pero no todos
When se consulta `timeseries` por dia
Then cada dia del rango aparece con conteo `0` si no tuvo eventos.

### HU6 - Autorizacion

Given un usuario no dueno intenta ver metricas
When llama summary/timeseries
Then recibe 403; admin puede ver todos.

## Modelo de datos

No crea tablas nuevas. Reemplaza RPCs existentes:

- `public.place_metrics_summary(uuid, timestamptz, timestamptz)`
- `public.place_metrics_timeseries(uuid, timestamptz, timestamptz, text)`

## Contratos API

Endpoints existentes:

- `GET /places/:placeId/metrics/summary`
- `GET /places/:placeId/metrics/timeseries`

`summary` agrega:

- `prev_total_views`, `prev_total_calls`, `prev_total_whatsapp`, `prev_total_reservations`, `prev_total_directions`, `prev_total_promo_views`
- `views_change_percent`, `calls_change_percent`, `whatsapp_change_percent`, `reservations_change_percent`, `directions_change_percent`, `promo_views_change_percent`

## UI/UX

- KPIs muestran numero principal y variacion vs periodo anterior.
- La grafica conserva el estado vacio solo si realmente no hay actividad total, pero la serie tiene buckets cero para mantener continuidad visual.

## Fuera de alcance

- Export CSV/PDF.
- Segmentacion por ciudad/categoria.
- Metricas multi-negocio agregadas para duenios con varias sedes.
