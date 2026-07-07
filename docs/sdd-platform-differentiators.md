# SDD: Xitty Differentiators Roadmap

## Objetivo

Convertir Xitty de un catalogo turistico en un asistente de ciudad que ahorra tiempo, reduce errores, arma planes y crea experiencias memorables. Este SDD cubre lo que falta por implementar: audiotours, Rewards Rally, planificador del dia, micrositios personalizables, experiencias exclusivas, geolocalizacion avanzada y chat AI contextual.

## Estado Actual

Ya existe una base funcional para:

- Home con promociones, ranking, recomendados, categorias, experiencias y local picks.
- Preferencias de viajero: tipo, presupuesto, energia, tiempo y acompanantes.
- Geolocalizacion web con snapshots mientras la app esta abierta.
- Micrositios publicos basicos de lugares.
- Chat AI con conversaciones.
- Sugerencias contextuales de seguridad/precio/playa.
- Boton de emergencia.
- Experiencias, reservas y promociones.

## Principios De Implementacion

- Construir por capacidades reutilizables, no solo pantallas.
- Priorizar features que refuercen el diferencial: plan hecho, ciudad narrada, premios y seguridad.
- Mantener APIs pequenas y versionables.
- Hacer que cada nueva feature funcione en lugar, micrositio y home cuando aplique.
- Preparar datos para analitica desde el MVP.

## Modulo 1: Audiotours

### Proposito

Permitir que sitios de interes como castillos, murallas, plazas o museos tengan recorridos narrados por audio en varios idiomas.

### Implementacion

- Backend:
  - `audio_tours`: tour por lugar e idioma.
  - `audio_tour_stops`: paradas ordenadas con audio, transcript, coordenadas opcionales y duracion.
  - `audio_tour_progress`: progreso por usuario.
  - Endpoints publicos para leer tours activos.
  - Endpoints protegidos para guardar progreso.
- Frontend:
  - Card/player en detalle de lugar.
  - Bloque de audiotour en micrositio.
  - Estado de progreso: empezar, continuar, completado.
- Admin futuro:
  - Crear guiones, subir audio, ordenar paradas, publicar/despublicar.

### Complejidad

Media-alta. Requiere modelo de datos, API, UI, contenido, storage de audio y flujo editorial.

## Modulo 2: Rewards Rally

### Proposito

Gamificar recorridos de observacion y aprendizaje con premios desbloqueables.

### Implementacion

- Backend:
  - `rallies`: campanas o recorridos.
  - `rally_tasks`: retos por parada, quiz, check-in o observacion.
  - `rally_rewards`: premios/cupones.
  - `rally_progress`: avance por usuario.
  - Validacion de ubicacion y reglas antifraude basicas.
- Frontend:
  - Vista "Rewards Rally".
  - Misiones activas.
  - Progreso y premio desbloqueado.
- Integraciones:
  - Usar audiotours y geolocalizacion como senales de progreso.

### Complejidad

Alta. No es solo UI: implica reglas, premios, progreso, antifraude, analytics y panel admin.

## Modulo 3: Planificador "Que Vale La Pena Hacer Hoy"

### Proposito

Pasar de recomendaciones sueltas a planes concretos segun tiempo, presupuesto, energia y compania.

### Implementacion

- Backend:
  - Extender recomendaciones con input explicito: `available_minutes`, `budget`, `energy`, `companions`, `traveler_type`.
  - Crear respuesta tipo itinerario: bloques ordenados, razon, costo estimado y distancia.
  - Reusar ranking, favoritos, preferencias, promociones y experiencias.
- Frontend:
  - Controles simples en home.
  - Resultados como "plan hecho", no listado.
  - Acciones: guardar plan, abrir mapa, reservar.

### Complejidad

Media-alta. La base existe, pero falta motor de itinerarios y UX de decision.

## Modulo 4: Micrositios Personalizables

### Proposito

Dar a negocios y sitios de interes paginas mas configurables y comerciales.

### Implementacion

- Backend:
  - `microsite_sections` o JSON versionado para secciones.
  - Soporte para audio, galeria destacada, promociones, reservas y CTAs.
  - Permisos por owner/admin.
- Frontend:
  - Editor en dashboard.
  - Renderer publico por secciones.

### Complejidad

Media. Hay micrositios basicos; falta builder y permisos finos.

## Modulo 5: Experiencias Locales Y Exclusivas

### Proposito

Empujar actividades como paseo en coche, picnic bajo estrellas, spots de fotos y yoga al amanecer.

### Implementacion

- Backend:
  - Fortalecer `experiences` con curaduria, tags editoriales, cupos, ubicacion y disponibilidad.
  - Relacionar experiencias con influenciadores o colecciones Xitty.
- Frontend:
  - Secciones de home mas orientadas a planes.
  - Landing/detail con reserva rapida.

### Complejidad

Media. Gran parte es contenido/operacion; tecnicamente se apoya en experiences existentes.

## Modulo 6: Geolocalizacion Avanzada

### Proposito

Usar ubicacion para contexto, seguridad, check-ins y rutas.

### Implementacion

- Web:
  - Mejorar consentimiento, limpieza de datos y estado visible.
  - Usar snapshots para recomendaciones y sugerencias.
- Mobile futuro:
  - Background location con consentimiento explicito.
  - Politicas de bateria y retencion.

### Complejidad

Media en web, alta si se requiere ubicacion permanente/background real.

## Modulo 7: Chat AI Contextual

### Proposito

Responder preguntas practicas: precios, zonas seguras, playas, planes y errores a evitar.

### Implementacion

- Backend:
  - Ampliar RAG con lugares, experiencias, sugerencias, promociones, seguridad y audiotours.
  - Tooling interno para buscar planes y lugares.
  - Guardrails para seguridad y emergencias.
- Frontend:
  - Prompts sugeridos por contexto.
  - Respuestas con acciones: reservar, guardar, abrir ruta.

### Complejidad

Media. El chat existe; falta mejor contexto y acciones.

## Orden Recomendado

1. Audiotours MVP.
2. Planificador de hoy MVP.
3. Rewards Rally MVP.
4. Micrositios configurables.
5. Experiencias exclusivas/curadas.
6. Chat contextual avanzado.
7. Geolocalizacion background/mobile.

## Primer Corte Tecnico

Se inicia con Audiotours porque:

- Es un diferencial explicito del requerimiento.
- Conecta con lugares y micrositios existentes.
- Prepara datos reutilizables para Rewards Rally.
- Puede lanzarse con pocos sitios piloto sin bloquear todo el roadmap.
