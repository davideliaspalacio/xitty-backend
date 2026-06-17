# Xitty · Análisis del pivot a producto contextual

> Documento de análisis estratégico. Resultado de un workflow de auditoría exhaustiva sobre el estado actual de Xitty (backend NestJS + Supabase, frontend Next.js 16) contrastado con la nueva visión de producto.

---

## TL;DR

Xitty hoy es un **catálogo serio y estático** con auth, places, ranking, experiencias y preferencias capturadas **pero nunca aplicadas**. El pivot pide un **producto contextual, gamificado y caribeño** anclado en geolocalización permanente, audio-tours multiidioma y un chat AI — features que no existen ni en backend ni en frontend.

El gap crítico **no es la UI**: es que los datos de personalización ya guardados no alimentan ningún engine, y faltan tres pilares net-new (audio-tours, chat AI, gamificación) que requieren contenido + infra externa, no solo código.

---

## Matriz de gaps — 18 features

Incluye los 15 originales + 3 que el verifier adversarial identificó como olvidados (PostGIS, i18n, push, offline tratado como dependencia de audio).

Estado: ✅ existe · 🟡 parcial · ❌ falta · Effort: S (<1 sem), M (1-2 sem), L (2-4 sem), XL (>1 mes)

| # | Feature | Estado | Backend nuevo | Frontend nuevo | Effort | Depende de |
|---|---|---|---|---|---|---|
| 1 | Visibilizados por Ads / Promociones | 🟡 | `ad_placements` + `ad_impressions` (la tabla `promotions` actual es para promos de negocios, no inventario pagado) | Hero rotatorio sección #1 + tracking | M | Métricas |
| 2 | Qué vale la pena hoy (personalizado) | ❌ | `GET /recommendations/today` que combine prefs + ubicación + hora + clima + ranking; tabla `daily_recommendations`; cron nocturno | Sección #2 con cards contextuales + "el porqué" | L | #10 Geo, #16 PostGIS |
| 3 | Lo más visitado (ranking) | ✅ | — | Reordenar en home | S | — |
| 4 | Rewards Rally (gamificación) | ❌ | Tablas `user_achievements`, `user_points_ledger`, `rally_quests`, `rally_progress`; RPC `validate_checkin(user,place,lat,lng)` con anti-spoof; catálogo de premios + canje atómico | Sección #4 con quests, mapa de detalle, animación unlock, badges, modal canje | XL | #10 Geo + partnerships (o premios propios) |
| 5 | Recomendados (Xitty + influencers) | 🟡 | Tabla `curators`, `curator_profiles`; extender `featured_content` con `curator_id` | Sección #5 con avatares + perfil de curador | M | Programa influencers |
| 6 | Categorías | ✅ | — | Grid visual vibrante por categoría | S | UI refresh |
| 7 | Experiencias | ✅ | Endpoint "experiencias cerca de mí" | Sección #7 + refresh visual del card (hoy el más frío) | S | — |
| 8 | Disfruta como local | ✅ | — | Sección #8 con estética polaroid/zine | S | — |
| 9 | Modalidades de viajero (segmentador) | 🟡 | Endpoints discover aceptan `?traveler_type=` o lo derivan del JWT; etiquetar contenido | Chips de modalidad en home top que re-filtran | M | #2 |
| 10 | Geolocalización permanente | 🟡 | Tabla `user_location_snapshots` con RLS y retención 7d; endpoint POST batch; opt-in | Permission flow, heartbeat 5min, banner, toggle settings, fallback IP-geo | L | Permisos SO, política privacidad |
| 11 | Micrositios personalizables | ✅ | Editor de bloques (form-based MVP) | Editor visual para owners | M | — |
| 12 | **Audio-tours multiidioma (CRÍTICO)** | ❌ | Tablas `audio_tours`, `audio_chapters` (con geofence), `tour_progress`; signed URLs; pipeline subida + validación | Player full-screen, mapa con chapters, transcript sync, selector idioma | XL | #10 Geo, **producción contenido (3-6 meses, USD 15-40k/idioma)** |
| 13 | Botón de emergencia | ❌ | Tablas `emergency_contacts`, `emergency_events`; **integración WhatsApp Business API** (no Twilio SMS — en Colombia entrega mejor) | FAB rojo en header, countdown 3s anti-accidente, modal con CTAs grandes | S-M | WhatsApp Business approval |
| 14 | Chat AI agent | ❌ | `chat_conversations`, `chat_messages`; endpoint streaming SSE; LLM (recomendación: Claude Haiku por costo/calidad); embeddings catálogo en pgvector para RAG estricto; rate limit + cost tracking | Bubble FAB, panel sheet 85vh, markdown, deep-links | L | Presupuesto tokens, eval set |
| 15 | Sugerencias contextuales (precios, seguridad, playas) | 🟡 | Tabla `safety_zones` (geohash/polígono); RPC `suggestions_for(lat,lng,hour,prefs)`; curaduría manual MVP | Toast/banner contextual, badges en cards | M | Fuente de datos seguridad (curaduría manual) |
| **16** | **PostGIS + índices GiST** | ❌ | `CREATE EXTENSION postgis` + migrar a `geography(Point)` con índice GiST | — | S | — (bloqueante para #2, #10, #12, #15) |
| **17** | **i18n del producto** | ❌ | Columnas `translations jsonb` en `places`, `experiences`; columna `lang` en chat | Selector global de idioma, hook `useT()` | M | — (bloqueante para que #12 tenga sentido comercial) |
| **18** | **Push notifications + device tokens** | ❌ | Tabla `device_tokens`, integración FCM/APNs, scheduler de notif | Permiso push, opt-in | M | — (sin esto, #2 pierde 80% del valor) |

---

## Drivers psicológicos → features

| Driver | Features que lo cubren | Comentario clave |
|---|---|---|
| **Ahorrar tiempo** | #2 Hoy · #14 Chat AI · #3 Ranking · #15 Sugerencias | El AI chat es el atajo definitivo: "¿qué hago ahora?" en un mensaje |
| **Evitar errores** | #15 Sugerencias · #13 Emergencia · #8 Local · #14 Chat | Zonas seguras + precios reales = antídoto al miedo de turista |
| **Vivir algo exclusivo** | #7 Experiencias · #5 Recomendados · #1 Promos · #12 Audio tours | Cupos limitados ("solo 8 hoy") es el ingrediente de scarcity faltante |
| **Sentirse inteligente** | #12 Audio tours · #4 Rally · #8 Local · #5 Influencers | Audio-tours es el pilar emocional diferenciador (vs Google Maps) |
| **Tener un plan hecho** | #2 Hoy · #4 Rally quests · #7 Booking · #14 Chat | Rally Quests = literalmente "el plan hecho con recompensa" |
| **No ser el turista bobo** | #8 Local · #5 Curaduría · #12 Audio · #15 Sugerencias · #9 Modalidades | "Nómada" o "Negocios" debe poder esconder lo turístico cliché |

---

## Roadmap TDD por fases (refinado con feedback adversarial)

> Total: ~70-90 días-dev de código + tracks paralelos de contenido (audio) y BD (partnerships, WhatsApp approval). Audio-tours y partnerships son los caminos críticos **no-código** que deben arrancar en Fase 1 aunque se integren tarde.

### Fase 1 · Foundation (10-12 días)

Desbloquear iteración y activar lo que ya está semilla.

- Setup **vitest + RTL + Playwright** en frontend (3 días)
- **PostGIS** + migración de `places.latitude/longitude` a `geography(Point)` con índice GiST (1 día)
- **Geo permanente:** tabla `user_location_snapshots` con RLS estricta + retención 7d, endpoint POST batch, hook `useGeoHeartbeat`, banner, IP-geo fallback (4 días)
- **Activar `traveler_type`:** chips de modalidad en home que re-filtran fetchers (2 días)
- **Consent/privacidad:** tabla `consents`, endpoint `DELETE /location/snapshots/mine`, test del toggle off (2 días — **legal blocker**, Ley 1581 Colombia)

**Tests-first ejemplares:** `LocationService.saveSnapshot` aplica retención al insertar · RLS verificada con test de integración · `useGeoHeartbeat` se pausa con `visibilitychange` · degradación cuando `navigator.geolocation` no existe · permission states (denied, while-in-use, restricted)

### Fase 2 · Quick wins del home (9-11 días)

Convertir el catálogo en home contextual.

- **"Vale la pena hoy"** con motor de scoring (prefs + geo + hora + clima opcional via OpenWeather) + tabla `daily_recommendations` + cron nocturno (5 días)
- **Reordenamiento del home** según nueva jerarquía (1 día)
- **Refresh visual de cards** (`ExperienceCard`, `CategoriesGrid` con grid vibrante) (2 días)
- **Ads/Promos slot #1 — movido aquí desde Fase 6:** hero rotation simple, sin editor de micrositios — es revenue bloqueado y solo añade 2-3 días (3 días)

**Tests-first ejemplares:** `RecommendationsService.today` filtra por `available_time` < tiempo restante · excluye places cerrados a la hora actual · retorna `reason` legible nunca vacía · fallback a ranking si user sin prefs · randomización ponderada (mismo usuario en 3 días distintos ve ≥1 card distinta — evita "siempre los mismos 3")

### Fase 3a · Confianza inmediata (5-7 días)

- **Sugerencias contextuales** con `safety_zones` curadas manualmente (10 barrios MVP), badges en cards (4 días)
- **Botón emergencia** con WhatsApp Business API (no Twilio): tablas, FAB, countdown 3s (3 días)

### Fase 3b · Chat AI standalone (12-15 días)

> Partido de la Fase 3 original porque el verifier identificó que estaba brutalmente subestimada (10-12 días solo de chat).

- Decisión upfront: **Claude Haiku** por relación costo/calidad
- Embeddings del catálogo (places + experiences) en pgvector
- Endpoint SSE streaming, RAG estricto
- Rate limit + tracking de costo
- **Tests críticos: prompt injection, PII leak en RAG**
- Frontend: bubble FAB, panel sheet 85vh, markdown, deep-links

**Criterios duros:** 0 alucinaciones de precio/horario en eval set de 20 prompts · costo instrumentado por usuario · streaming < 2s al primer token

### Fase 4 · Push + i18n (foundation Fase 5) (8-10 días)

> Necesario antes de audio-tours porque sin i18n el feature multiidioma es teatro, y sin push "vale la pena hoy" pierde su impacto.

- **i18n schema:** columnas `translations jsonb` en `places`, `experiences`, tags
- **Frontend i18n:** selector global, `useT()` hook, fallback español
- **Push notifications:** tabla `device_tokens`, FCM/APNs, opt-in flow, scheduler básico

### Fase 5 · Audio-tours multiidioma (15-20 días código)

> MVP: 3 sitios × 2 idiomas (ES/EN). El track de **producción de contenido arranca en Fase 1** (guiones, locución) para estar listo aquí.

- Tablas `audio_tours`, `audio_chapters` (con geofence), `tour_progress`
- Storage + signed URLs con expiración
- Player full-screen con waveform
- Mapa con chapters
- **Offline pack** con Service Worker + IndexedDB (esto NO es S como decía el plan original — es L)
- Transcript sincronizado
- **Foreground-only para auto-play geofence en MVP** (background requiere Significant Location Change API, +3-5 días si se quiere)

### Fase 6 · Rewards Rally (10-12 días)

> Movido después de audio porque las partnerships son las que toman calendar time. Si en día 30 del roadmap no hay 1 partnership firmada, lanzar con **fallback no-blocking:** premios propios (descuentos en experiencias del catálogo).

- Tablas `rally_quests`, `rally_progress`, `user_achievements`, `user_points_ledger`
- RPC `validate_checkin` con **anti-fraud GPS:** accuracy threshold + nonce + rate limit + cross-check heading
- Ledger inmutable con **rollback transaccional** en redeem
- Frontend: sección home, mapa quest, animación unlock, modal canje

### Fase 7 · Curaduría y micrositios editables (10-12 días)

- Tabla `curators` + extender `featured_content` con `curator_id`
- Editor de bloques en micrositios (form-based MVP, NO drag-drop)
- Perfiles de influencers

---

## Dirección de UI — para las features nuevas

**Premisa de marca:** coral `#FF5A4E` = energía, gente, atardecer Malecón. Teal `#0E9F8C` = agua, frescura, calma. Barranquilla no es Cartagena postal; es ritmo, picó, mural callejero, sancocho a la una. La capa visual nueva tiene que **sonar a barrio, no a hotel boutique**.

### 3 movimientos sistémicos que rompen el "feel catálogo"

#### Movimiento 1 · Color crema cálido + borde negro flat
- Tokens nuevos: `--cream: #FFF4E8` (reemplaza blanco frío en chips, badges, burbujas chat) y `--ink: #1a1a1a` con utility `shadow-flat` (offset 4px sólido sin blur)
- Aplicar en: Rewards Rally, chips de idioma audio-tour, badges "HOY", quick replies del chat, franja polaroid del carrusel local
- Esfuerzo S · Riesgo bajo (refuerza el lado "barrio/artesanal" sin tocar coral/teal)

#### Movimiento 2 · Framer Motion para 3 micro-animaciones
- `breathe` (loop suave en CTAs primarios) · `pop-in` (entrada de chips/sellos) · `spring-tap` (todos los tap interactivos)
- Aplicar en: FAB chat, play de audio-tour, sellos Rally, chips de modalidad, chip "HOY"
- Esfuerzo M · Riesgo bajo si se mantiene sutil (200-600ms, no rebotes exagerados)

#### Movimiento 3 · Tipografía display para headings de secciones
- Sumar Recoleta o Fraunces (serif cálida) **solo** para headings de secciones del home. Body sigue Inter.
- Esfuerzo M · Riesgo medio (mal elegida envejece a "blog mom 2014", bien elegida sube nivel editorial inmediato)

### Tratamiento por feature nueva

| Feature | Concepto | Color predominante | Inspiración (sí copiar / NO copiar) |
|---|---|---|---|
| **#2 Vale la pena hoy** | Hero card full-bleed con overlay coral→teal 30%, chip "HOY" sticker crema, CTA pill coral | Coral protagonista, teal segundo | Citymapper "Get me home" · NO Spotify Wrapped |
| **#4 Rewards Rally** | Carnet de lotería de barrio con sellos coral, borde negro 2px, shadow flat coral 4px | Coral sellos hechos, teal pendientes, amarillo en confetti | Starbucks Rewards · NO Duolingo |
| **#12 Audio-tour cards** | Play button coral 56px que sale del marco de la foto, chips de idioma con banderas emoji | Coral play, teal ring de progreso | Detour app + Spotify podcast · NO GuruWalk |
| **#14 Chat AI** | FAB 64px gradient coral→teal solid, sheet 85vh, burbujas asimétricas | Gradient firma "Xitty inteligente" | Intercom Messenger + Replika · NO ChatGPT iOS |
| **#13 Botón emergencia** | Pill 36px discreto en header `rojo #DC2626 + SOS`, modal full-screen rojo en tap | Rojo emergencia puro (nunca mezclar con coral) | Uber SOS · NO parpadeos en idle |
| **#9 Modalidades** | Chips 40px horizontal scroll, on=coral solid scale 1.05 | Coral activo, crema idle | Airbnb category bar + Pinterest mood filters |
| **#8 Disfruta como local** | Cards levemente rotadas alternando, formato polaroid con franja crema, heading display con subrayado coral curvy | Foto natural + crema + coral subrayado | Cereal/Kinfolk + caribeño · NO polaroids literales con cinta |

---

## Riesgos serios (lo que puede matar el proyecto)

1. **Audio-tours es proyecto de contenido, no software.** Player y schema = 2 semanas. Producir 20 sitios × 5 idiomas con locución profesional = 3-6 meses y USD 15-40k por idioma. Sin contenido real, el feature es concha vacía. **Decisión necesaria:** ¿MVP con 3 sitios × 2 idiomas (ES/EN) o esperar a tener cobertura amplia?

2. **Geolocalización permanente choca con plataforma.** Background location en iOS exige justificación explícita y muchas apps son rechazadas. Android pide "all the time" con UI hostil. Battery drain mata adopción. **Mitigación adoptada:** foreground-only + heartbeat al abrir + IP geo fallback. Auto-play de audio-tour por geofence en background queda fuera del MVP.

3. **Chat AI tiene costo variable y reputacional.** A USD 0.01-0.03 por conversación, 10k usuarios × 5 conversaciones/mes = USD 500-1500/mes solo en tokens. Alucinaciones en horarios/precios = riesgo legal. **Mitigación:** Claude Haiku + RAG estricto + cuota dura + eval set + disclaimers.

4. **Rewards Rally sin premios reales muere.** **Mitigación adoptada:** kill-switch (si en día 30 no hay 1 partnership firmada, lanzar con descuentos propios del catálogo).

5. **Personalización con cold start.** Primeros 1000 usuarios verán recomendaciones mediocres. **Mitigación:** randomización ponderada top-20 + fallback a ranking + curaduría admin las primeras semanas.

6. **Seguridad/zonas: fuente de datos.** No existe API pública confiable. **Mitigación:** curaduría manual de 10 barrios MVP, con disclaimer legal en UI.

7. **Sin tests frontend, regresión garantizada.** Por eso Fase 1 incluye setup vitest + RTL + Playwright **antes** que features nuevas.

8. **GDPR / Ley 1581 Colombia.** Captura de ubicación cada 5min sin flow de consent + endpoint de borrado = bloqueador legal. Por eso se añadió como item Fase 1.

---

## Decisiones que necesito para arrancar

Antes de tirarme a código, hay 5 decisiones de producto/negocio que solo tú puedes tomar:

| # | Decisión | Opciones |
|---|---|---|
| **1** | **MVP de audio-tours** | (a) 3 sitios × 2 idiomas (ES/EN) en 1 mes · (b) 10 sitios × 3 idiomas en 3 meses · (c) Posponer audio-tours hasta Fase 5 sin compromiso de fecha |
| **2** | **Proveedor LLM para chat** | (a) Claude Haiku (recomendado costo/calidad) · (b) GPT-4o-mini (más barato pero más alucina) · (c) Gemini Flash · (d) Esperar a benchmark |
| **3** | **Premios Rally** | (a) Buscar partnerships locales (negocios de Barranquilla) - timeline 6-8 semanas · (b) Solo premios propios (descuentos en experiencias del catálogo) - listo en 1 sem · (c) Híbrido: arrancar con propios + sumar partnerships después |
| **4** | **Geo en background** | (a) Solo foreground en MVP (no auto-play audio por proximidad sin app abierta) · (b) Invertir 3-5 días extra para Significant Location Change API en iOS |
| **5** | **Botón emergencia** | (a) WhatsApp Business API (mejor entrega Colombia, requiere approval Meta 1-2 semanas) · (b) SMS via Twilio (más rápido de integrar) · (c) Solo botón "Llamar 123" (no infra externa, MVP en 1 día) |

---

## Mi recomendación honesta

Si pudiera elegir el primer paso: **Fase 1 completa** (10-12 días) + **slot de Ads en home** (3 días extra de Fase 2). Eso te da:

- Tests frontend funcionando (desbloquea todo lo demás)
- Personalización real activada (chips de modalidad ya cambian el contenido)
- Geo + consent + privacidad legal en orden
- **Revenue stream activado** (ads ya generan ingresos mientras construyes el resto)

Eso es ~2 semanas de trabajo y ya cambia la percepción del producto del "catálogo serio" actual.

Después decidimos según resultados si vamos por Chat AI (high impact, alta complejidad) o por Audio-tours (diferenciador máximo pero camino crítico es contenido).
