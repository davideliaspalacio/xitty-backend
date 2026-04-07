# Historias de usuario

Las 46 historias del proyecto Xitty, organizadas por módulo y fase. Cada una tiene sus criterios de aceptación.

**Tipos de usuario:**
- 🧳 **Turista** — usuario final
- 🏪 **Dueño** — comercio/establecimiento
- 👤 **Admin** — equipo interno Xitty

**Fases:**
- **Fase 1** (Marzo - Abril 2026): Fundamentos
- **Fase 2** (Abril - Mayo 2026): AI + Negocios
- **Fase 3** (Mayo - Junio 2026): Recomendación + Seguridad
- **Fase 4** (Junio 2026): Gamificación + Experiencias

---

## M1 — Autenticación + Onboarding (Fase 1, 5 historias)

### US-001 🧳 Registro con correo o Google
Como turista, quiero registrarme con mi correo o cuenta de Google, para acceder rápidamente sin formularios largos.

**Criterios:**
- Registro con email + password funciona
- Login con Google OAuth redirige y autentica sin errores
- Email de verificación al registrarse con correo
- Tokens JWT generados y almacenados de forma segura

### US-002 🧳 Wizard de preferencias
Como turista nuevo, quiero completar un wizard de preferencias (tipo viajero, presupuesto, energía), para recibir recomendaciones personalizadas desde el primer uso.

**Criterios:**
- Opciones tipo viajero: Nómada, Pareja, Familia, Negocios, Excursión
- Captura presupuesto, tiempo disponible, nivel de energía
- Las preferencias se guardan en el perfil
- El usuario puede saltar el wizard
- Las preferencias alimentan el motor de recomendación (M6)

### US-003 🧳 Editar perfil y preferencias
Como turista recurrente, quiero editar mi perfil y cambiar mis preferencias de viaje, para actualizar mi experiencia cuando viajo de forma diferente.

**Criterios:**
- Sección "Mi perfil" accesible desde el menú
- Editables: tipo viajero, presupuesto, energía, acompañantes
- Los cambios se reflejan inmediatamente

### US-004 🧳 Recuperar contraseña
Como turista, quiero recuperar mi contraseña si la olvido, para no quedarme sin acceso.

**Criterios:**
- Flujo de recuperación por email con link seguro
- Token expira en 1 hora
- Confirmación visual de cambio exitoso

### US-005 🧳 Ver perfil con historial y guardados
Como turista, quiero ver mi perfil con historial de actividad y lugares guardados, para tener un resumen de todo lo que he hecho en Xitty.

**Criterios:**
- Sección con lugares visitados, guardados y reseñados
- Badges y logros visibles
- Estadísticas: lugares visitados, rutas completadas

---

## M2 — Geolocalización + Mapas (Fase 1, 5 historias)

### US-006 🧳 Mapa interactivo con lugares cercanos
Mapa centrado en GPS, markers diferenciados por categoría, zoom/pan, info rápida al tocar. Mapbox o Google Maps SDK.

### US-007 🧳 Filtros del mapa
Filtros por categoría, precio, distancia. En tiempo real, combinables, con botón "limpiar".

### US-008 🧳 Alertas de proximidad
Push notification a menos de 200m. Máximo 3 por hora. Desactivable. Geolocation tracking en background opt-in.

### US-009 🧳 Mapa de calor de zonas populares
Heatmap overlay con toggle. Datos basados en visitas y check-ins. Actualización cada 24h.

### US-010 🧳 Ubicación en tiempo real con ruta
Botón "Cómo llegar" muestra ruta sobre mapa con distancia y tiempo. Opción de abrir en Google Maps o Waze.

---

## M3 — Directorio de Lugares (Fase 1, 6 historias)

### US-011 🧳 Listado de lugares
Cards con foto, nombre, rating, categoría, precio. Ordenable por distancia, rating, precio, popularidad. Vista lista/grilla. Scroll infinito o paginación.

### US-012 🧳 Detalle de lugar
Galería, descripción, horarios, precio, mapa embebido, reseñas, botones (guardar, compartir, reportar), enlace al micrositio.

### US-013 🧳 Búsqueda por nombre o keywords
Barra con autocompletado (debounce 300ms). Búsqueda en nombre, categoría, tags, descripción. Ordenado por relevancia.

### US-014 🧳 Dejar reseña y rating
Rating 1-5 + comentario. Solo autenticados. Una reseña por usuario por lugar (editable). Rating promedio en tiempo real.

### US-015 🧳 Guardar lugares en favoritos
Botón corazón. Sección "Mis favoritos". Sincronizado entre dispositivos.

### US-016 🧳 Compartir lugar
Link con preview Open Graph. Compatible WhatsApp, Instagram Stories, Twitter. Foto + nombre + rating.

---

## M4 — AI Chat Guide (Fase 2, 4 historias)

### US-017 🧳 Chat con asistente AI
Chat tipo WhatsApp. Integrado con LLM (OpenAI/Claude API) con contexto de Xitty. Responde preguntas con lugares reales de la DB. Respuesta < 5 segundos.

### US-018 🧳 Preguntar al AI sobre seguridad
Info de seguridad basada en datos curados. Recomendaciones generales (horarios, precauciones). Lenguaje balanceado.

### US-019 🧳 Memoria de conversación
Memoria por sesión (context window). Historial guardado por usuario. Botón nueva conversación.

### US-020 🧳 Sugerencias del AI con links
Cards clickeables de lugares en las respuestas. Tap → detalle. AI puede sugerir itinerarios completos.

---

## M5 — Micrositios de Negocios (Fase 2, 5 historias)

### US-021 🏪 Micrositio del negocio
Perfil: nombre, descripción, fotos, horarios, ubicación. Promociones activas con vencimiento. CTAs: llamar, WhatsApp, reservar, cómo llegar. URL única `xitty.co/negocio-nombre`.

### US-022 🏪 Panel de gestión del micrositio
Dashboard editable: fotos, descripción, horarios, promos. Preview antes de publicar. Compresión automática de imágenes. Mobile-friendly.

### US-023 🏪 Métricas del micrositio
Visitas, clicks en CTA, vistas de promos. Gráfico semanal/mensual. Comparativa con período anterior. Datos diarios (PostHog).

### US-024 🏪 Crear y gestionar promociones
CRUD de promos: título, descripción, % descuento. Fechas inicio/vencimiento. Destacadas en directorio. Notificación a usuarios cercanos al activar.

### US-025 🏪 Notificaciones de interacción
Push/email cuando alguien hace click en "Llamar" o "WhatsApp". Resumen diario. Configurable.

---

## M6 — Motor de Recomendación AI (Fase 3, 4 historias)

### US-026 🧳 Plan del día personalizado
Algoritmo considera tiempo, presupuesto, energía, ubicación. Itinerario ordenado con horarios y rutas. Botón "otra opción". Distancias lógicas. Scoring multi-variable.

### US-027 🧳 Recomendaciones que mejoran con el uso
Registra: lugares visitados, ratings, tiempo en cada lugar. Prioriza categorías con mejor historial. Excluye visitados (salvo restaurantes).

### US-028 🧳 Recomendaciones según clima
Integración OpenWeather. Lluvia → cerrados, museos, restaurantes. Sol → al aire libre. Clima visible como contexto.

### US-029 🧳 Recomendaciones según hora
Mañana: cafés, desayunos, actividades al aire libre. Tarde: almuerzos, tours, museos. Noche: restaurantes, bares, entretenimiento. Detección automática.

---

## M7 — Ranking + Contenido Destacado (Fase 3, 3 historias)

### US-030 🧳 Ranking de lugares populares
Ranking dinámico: visitas, ratings, conversión. Categorizado: restaurantes, sitios, experiencias. Actualización 24h. Muestra posición y cambio.

### US-031 🏪 Posicionamiento premium pagado
"Lugar destacado" con badge. Posiciones prioritarias. Cobro mensual o por período. Marcado como "patrocinado".

### US-032 🧳 Contenido destacado curado
Sección "Recomendados" en home. Curado por equipo Xitty + influencers aliados. Rotación semanal.

---

## M8 — Seguridad (Fase 3, 3 historias)

### US-033 🧳 Información de seguridad por zona
Overlay verde/amarillo/rojo en mapa. Datos curados. Tips por zona. Toggle on/off.

### US-034 🧳 Botón de emergencia
Accesible con 1 tap. Comparte GPS con contacto de emergencia. Llamar al 123 (Colombia). Registro en historial.

### US-035 🧳 Contactos de emergencia
Hasta 3 contactos. Notificación SMS con GPS. Configurable desde perfil.

---

## M9 — Gamificación QR (Fase 4, 4 historias)

### US-036 🧳 Rutas guiadas con QR
Rutas predefinidas con paradas. QR físico en cada parada. Al escanear: info + progreso. Barra "Paso 1/5". Scanner integrado.

### US-037 🧳 Recompensas por completar rutas
Descuento, badge o contenido exclusivo. Sistema de logros visibles en perfil. Ranking de usuarios activos.

### US-038 🏪 Negocio como parada en ruta QR
Solicitar inclusión en rutas. Costo monetizable. Ofrecer descuento en la parada. Métricas de escaneos.

### US-039 🧳 Listado de rutas QR
Listado con duración, paradas, distancia. Dificultad: fácil/medio/aventurero. Mapa previo. Rating y reseñas.

---

## M10 — Experiencias (Fase 4, 4 historias)

### US-040 🧳 Descubrir experiencias únicas
Sección "Experiencias". Fotos, descripción, duración, precio, ubicación. Filtros: tipo, precio, duración, disponibilidad. Tags: romántico, aventura, relax, cultural, gastronómico.

### US-041 🧳 Reservar experiencia
Botón "Reservar" con fecha/hora. Confirmación email + push. "Mis reservas". Cancelación hasta 24h antes.

### US-042 🧳 Sección "Disfruta como local"
Curado manual + AI. Lugares no turísticos verificados. Tags: "favorito local", "secreto", "auténtico". Actualización semanal.

### US-043 🧳 Reseñas y fotos en experiencias
Reseñas con fotos de usuarios. Rating promedio + distribución de estrellas. Filtrar por más recientes / mejor calificadas.

---

## M11 — Plan Personalizado (Fase 4, 3 historias)

### US-044 🧳 Generar itinerario completo desde formulario
Formulario: fechas, presupuesto, intereses, acompañantes. Output día por día con horarios y rutas. Generado por AI con datos reales. Exportable PDF o link. Editable.

### US-045 🧳 Guardar y acceder a itinerarios
Sección "Mis planes". Cada plan muestra progreso. Accesible offline (cache local).

### US-046 🧳 Compartir itinerario
Link compartible. Vista pública sin cuenta. Actualizaciones en tiempo real si se modifica.