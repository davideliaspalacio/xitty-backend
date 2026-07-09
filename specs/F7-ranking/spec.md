# F7 - Ranking inteligente

## Objetivo

Fortalecer el ranking de lugares para que exista un top general, por ciudad y por categoria, recalculado de forma nocturna, con score basado en ratings + visitas + clicks reales y delta de posicion semanal.

## Usuarios afectados

- Turista: entiende que lugares son mas relevantes y si subieron/bajaron.
- Admin Xitty: puede refrescar ranking manualmente y ajustar pesos desde datos configurables.
- Negocio: no pierde posicion organica por patrocinios; F8 se mantiene separado.

## Historias y criterios de aceptacion

### US-F7-01 - Ranking general real

Given lugares activos con scores calculados, when el turista consulta `GET /ranking`, then recibe el top general ordenado por posicion global.

### US-F7-02 - Ranking por categoria

Given una categoria, when el turista consulta `GET /ranking/categories/:categoryId`, then recibe el top de esa categoria ordenado por posicion de categoria.

### US-F7-02b - Ranking por ciudad

Given una ciudad como Cartagena o Barranquilla, when el turista consulta `GET /ranking?city=Cartagena`, then recibe el top de esa ciudad ordenado por posicion de ciudad.

Given una ciudad y una categoria, when el turista consulta `GET /ranking/categories/:categoryId?city=Cartagena`, then recibe el top de esa categoria dentro de esa ciudad.

### US-F7-03 - Score balanceado y configurable

Given lugares con ratings, visitas y clicks, when se recalcula el ranking, then el score combina:

- rating bayesiano normalizado,
- vistas de perfil de los ultimos N dias,
- clicks/conversiones reales de los ultimos N dias.

Los pesos y caps viven en tabla configurable.

### US-F7-04 - Delta semanal

Given snapshots historicos, when se consulta el ranking, then cada item incluye `previous_position` y `position_change` contra el snapshot de hace al menos 7 dias.

### US-F7-05 - Refresh seguro

Given el job nocturno o refresh manual, when recalcula, then refresca la materialized view y escribe snapshots/logs sin mezclar patrocinios con ranking organico.

## Modelo de datos

Nuevos/ajustados:

- `ranking_config`: pesos y parametros (`rating_weight`, `views_weight`, `conversions_weight`, `rating_prior`, `rating_prior_reviews`, `views_cap`, `conversions_cap`, `window_days`).
- `ranking_refresh_logs`: bitacora de refresh exitoso.
- `places.city` y `places.zone`: scope operativo para ranking/datos.
- `scraped_items_enriched.city` y `scraped_items_enriched.zone`: se copian desde `scraping_sources.config`.
- `ranking_snapshots.scope`: `global`, `category`, `city` o `city_category`.
- `place_rankings`: agrega `global_position`, `category_position`, `city_position`, `city_category_position`, `rating_score`, `views_score`, `conversions_score`.

## Contratos API

- `GET /ranking?limit=10`: devuelve ranking general.
- `GET /ranking?limit=10&city=Cartagena`: devuelve ranking general dentro de una ciudad.
- `GET /ranking/categories/:categoryId?limit=20`: devuelve ranking por categoria.
- `GET /ranking/categories/:categoryId?limit=20&city=Cartagena`: devuelve ranking por categoria dentro de una ciudad.
- `POST /admin/ranking/refresh`: admin, fuerza refresh.

El response mantiene:

- `position`
- `previous_position`
- `position_change`
- `score`
- `views_30d`
- `conversions_30d`
- `is_sponsored` / `sponsored_label`
- `place`

## Autorizacion

- Lectura publica del ranking.
- Refresh manual solo admin.
- Configuracion se deja por migracion/DB en este PR; UI admin de pesos queda fuera.

## UI/UX

- Home mantiene cards de ranking.
- La card muestra flecha y numero de posiciones subidas/bajadas; si no hay snapshot muestra estado neutro.

## Edge cases

- Empates: desempate estable por `place_id`.
- Lugar sin ratings: usa promedio bayesiano con prior configurable.
- Lugar con ratings pero sin visitas: rating aporta, actividad queda 0.
- Lugar con visitas pero sin ratings: prior evita castigo absoluto.
- Falla del job: el ranking visible conserva la materialized view previa si el refresh no termina.
- Categoria con pocos lugares: devuelve los disponibles sin error.
- Lugar desactivado: no entra al materialized view.
- Ciudad vacia o ausente: el API conserva el ranking global existente.
- Ciudad + categoria: usa snapshots `city_category` para delta semanal.

## Fuera de alcance

- UI admin para editar pesos.
- Patrocinios comerciales avanzados (F8).
- Seeds de datos nuevos (F1).

## Decisiones tomadas

- Pesos MVP: rating 45%, vistas 25%, conversiones 30%. Ratings se normalizan con promedio bayesiano para evitar que un lugar con 1 review domine el ranking.
- Ventana de actividad: 30 dias configurable.
- Delta semanal: se usa snapshot de al menos 7 dias para evitar ruido diario.
- Ciudad se guarda como texto operacional (`Cartagena`, `Barranquilla`) y se filtra por igualdad exacta normalizando espacios del query param.
