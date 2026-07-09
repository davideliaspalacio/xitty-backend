# Cutover produccion - Features v2

Objetivo: aplicar y validar el paquete Features v2 en Supabase produccion/staging sin depender de memoria ni de pasos sueltos.

Estado probado localmente:

- Codigo backend y frontend mergeado en `main`.
- `supabase db reset` OK en una DB limpia temporal, aplicando todas las migraciones hasta `20260709000013_harden_backend_service_role_and_place_rpc.sql`.
- Migraciones adicionales pendientes de aplicar en el siguiente cutover: `20260709000014_extend_place_data_completeness_report.sql` y `20260709000015_add_reservation_created_notifications.sql`.
- Backend contra DB migrada respondio 200 en `/categories`, `/places?city=Cartagena`, `/places?sort_by=distance&city=Cartagena` y `/ranking?city=Cartagena`.

## 1. Pre-check obligatorio

Antes de tocar produccion:

1. Confirmar backup/snapshot reciente de Supabase.
2. Confirmar que backend y frontend van a desplegar desde `main`.
3. Confirmar `GOOGLE_MAPS_API_KEY` en el runtime del backend.
4. Confirmar `NEXT_PUBLIC_DEFAULT_CITY` en el runtime del frontend.
5. Confirmar que no se van a publicar fotos masivamente hasta aprobar politica/licencia de fotos.

## 2. Aplicar migraciones

Ruta recomendada con Supabase CLI:

```bash
supabase login
supabase link --project-ref <project-ref-produccion>
supabase db push
```

Si el equipo no puede usar el CLI y necesita SQL Editor, generar un bundle local desde `xitty-backend`:

```bash
awk 'FNR == 1 { print "\n-- >>> " FILENAME "\n" } { print }' supabase/migrations/202607090000*.sql > /tmp/xitty-features-v2-migrations.sql
```

Luego pegar `/tmp/xitty-features-v2-migrations.sql` completo en el SQL Editor del proyecto correcto y ejecutarlo una sola vez. Si el SQL Editor corta por timeout, ejecutar los archivos en orden cronologico, uno por uno, desde `20260709000001...` hasta `20260709000015...`.

Despues de aplicar:

```sql
SELECT public.refresh_place_rankings();
```

## 3. Validacion SQL post-migracion

Ejecutar este bloque en Supabase SQL Editor. Las dos primeras consultas deben devolver cero filas.

```sql
WITH required_columns(table_name, column_name) AS (
  VALUES
    ('microsite_interactions', 'anonymous_session_hash'),
    ('microsite_interactions', 'user_agent_hash'),
    ('microsite_interactions', 'dedup_key'),
    ('microsite_interactions', 'metadata'),
    ('ranking_snapshots', 'scope'),
    ('ranking_snapshots', 'city'),
    ('places', 'sponsorship_priority'),
    ('places', 'source_kind'),
    ('places', 'source_external_id'),
    ('places', 'source_url'),
    ('places', 'data_provenance'),
    ('places', 'city'),
    ('places', 'zone'),
    ('place_rankings', 'city'),
    ('place_rankings', 'city_position'),
    ('place_rankings', 'city_category_position'),
    ('scraped_items_enriched', 'source_kind'),
    ('scraped_items_enriched', 'source_external_id'),
    ('scraped_items_enriched', 'city'),
    ('scraped_items_enriched', 'zone'),
    ('place_data_completeness', 'city'),
    ('place_data_completeness', 'zone'),
    ('place_data_completeness', 'category_id'),
    ('place_data_completeness', 'category_name'),
    ('place_data_completeness', 'category_slug'),
    ('place_data_completeness', 'missing_count')
)
SELECT *
FROM required_columns rc
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_attribute a
  WHERE a.attrelid = to_regclass('public.' || rc.table_name)
    AND a.attname = rc.column_name
    AND a.attnum > 0
    AND NOT a.attisdropped
)
ORDER BY table_name, column_name;

WITH required_relations(relation_name) AS (
  VALUES
    ('active_promotions'),
    ('active_hero_promotions'),
    ('business_notification_outbox'),
    ('current_featured'),
    ('place_data_completeness'),
    ('place_rankings'),
    ('ranking_config'),
    ('ranking_refresh_logs')
)
SELECT *
FROM required_relations rr
WHERE to_regclass('public.' || rr.relation_name) IS NULL
ORDER BY relation_name;

SELECT
  proname,
  pg_get_function_identity_arguments(oid) AS args
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'expire_sponsorships',
    'generate_daily_business_summaries',
    'list_places_near',
    'metrics_change_percent',
    'place_metrics_summary',
    'place_metrics_timeseries',
    'places_set_slug',
    'refresh_place_rankings'
  )
ORDER BY proname, args;

SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.business_notification_outbox'::regclass
  AND conname = 'business_notification_outbox_notification_type_check'
  AND pg_get_constraintdef(oid) ILIKE '%reservation_created%';
```

Checks esperados:

- `places.city` y `place_rankings.city` existen.
- `list_places_near` tiene la firma nueva con `p_city` y `p_zone`.
- `business_notification_outbox` existe para F6.
- El check `business_notification_outbox_notification_type_check` acepta `reservation_created`.
- `place_data_completeness` existe para reporte F1 y expone ciudad/zona/categoria/missing_count.
- `refresh_place_rankings()` corre sin error.

## 4. Smoke HTTP post-migracion

Con backend levantado contra esa misma DB:

```bash
npm run smoke:features-v2 -- --api-url "$API_URL" --city Cartagena
```

El comando sale con codigo `3` cuando detecta errores tipicos de migraciones faltantes (`places.city`, `place_rankings.city` o RPC `list_places_near`).

Equivalente manual:

```bash
API_URL="${API_URL:-https://api.xitty.co}"

curl -i "$API_URL/categories"
curl -i "$API_URL/places?city=Cartagena&limit=1"
curl -i "$API_URL/places/search?q=castillo&city=Cartagena&limit=1"
curl -i "$API_URL/places?sort_by=distance&latitude=10.4&longitude=-75.5&city=Cartagena&limit=1"
curl -i "$API_URL/ranking?city=Cartagena"
curl -i "$API_URL/promotions/active"
curl -i "$API_URL/featured/current"
```

Debe cambiar el estado actual de error:

- Antes de migrar: `/places?city=Cartagena` falla por `column places.city does not exist`.
- Antes de migrar: `/ranking?city=Cartagena` falla por `column place_rankings.city does not exist`.
- Despues de migrar: ambos deben responder 200.

## 5. Poblar datos reales

Despues de migrar y verificar envs:

1. Entrar como admin a `/admin/scraping`.
2. Ejecutar fuentes de Cartagena por tandas chicas.
3. Revisar cola de moderacion antes de publicar.
4. Publicar una muestra controlada.
5. Revisar completitud desde `/admin/scraping` > "Calidad de datos" y, si hace falta, confirmar por SQL:

```sql
SELECT
  COUNT(*) AS total_places,
  COUNT(*) FILTER (
    WHERE COALESCE(cardinality(missing_fields), 0) = 0
  ) AS complete_places,
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE COALESCE(cardinality(missing_fields), 0) = 0
    ) / NULLIF(COUNT(*), 0),
    1
  ) AS complete_percent
FROM public.place_data_completeness;

SELECT name, missing_fields
FROM public.place_data_completeness
WHERE COALESCE(cardinality(missing_fields), 0) > 0
ORDER BY cardinality(missing_fields) DESC NULLS LAST, name
LIMIT 50;

SELECT
  COALESCE(category_name, 'Sin categoria') AS category_name,
  COUNT(*) AS total_places,
  COUNT(*) FILTER (WHERE COALESCE(cardinality(missing_fields), 0) > 0) AS incomplete_places,
  ROUND(AVG(completeness_score) * 100, 1) AS average_complete_percent
FROM public.place_data_completeness
GROUP BY category_name
ORDER BY incomplete_places DESC, total_places DESC;
```

No publicar fotos masivamente hasta tener politica/licencia aprobada.

## 6. QA final

Validar con datos reales:

- Landing publica con features activadas.
- Perfil publico por slug y preview Open Graph.
- CTAs reales: llamar, WhatsApp, reservar y como llegar.
- Promociones activas con fechas Colombia.
- Tracking anonimo y deduplicacion de doble click.
- Dashboard de metricas con dias sin eventos en cero.
- Outbox de notificaciones respetando preferencias.
- Reservas confirmadas encolan `reservation_created` cuando la preferencia de reservas esta activa.
- Ranking por ciudad/categoria.
- Sello "Patrocinado" visible.
- Destacados semanales y fallback.
- Reporte admin de calidad de datos en `/admin/scraping`.

## 7. Pendientes que no bloquean el deploy tecnico

- Definir proveedor/canal externo para notificaciones.
- Aprobar politica legal de fotos.
- Cargar audiotours adicionales.
- Cargar promociones reales o marcarlas como demo.
