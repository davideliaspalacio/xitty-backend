-- ============================================================================
-- XITTY · FULL SEED · v2 (additions sobre v1)
-- ============================================================================
-- Pega y ejecuta DESPUÉS de full-seed.sql para enriquecer todos los datos.
-- Tarda ~30-60s. Idempotente donde es posible (ON CONFLICT DO NOTHING).
--
-- Qué agrega:
--   • +400 reseñas de places       → ~1000 totales · top places con 30+
--   • +150 reseñas de experiencias → ~230 totales
--   • +180 cupos futuros           → muchas más fechas para reservar
--   • +150 reservas confirmadas   → reservas próximas más densas
--   • +50 promociones activas      → casi todos los places con promo
--   • +5000 interacciones (90d)    → ~10K totales · gráficas más densas
--   • +200 fotos en top 20 places  → galerías con 10-15 fotos
--   • Tags enriquecidos por categoría (vegetariano, pet-friendly, wifi, etc.)
--   • 2 edge cases: place sin nada + place inactivo
--   • +4 semanas históricas de featured + local_picks
--   • 3 turistas VIP con actividad masiva
--   • 1 place top (5.0 ★) + 1 place flojo (2.0 ★)
--   • Refresh de aggregates y ranking al final
-- ============================================================================

-- ============================================================================
-- A) +400 RESEÑAS DE PLACES
-- ============================================================================
-- Usa filtro de hash complementario al de v1 para tomar combinaciones nuevas.

WITH numbered_places AS (
  SELECT id, row_number() OVER (ORDER BY created_at DESC) AS pn
  FROM public.places
  WHERE created_at > now() - interval '24 hours'
  LIMIT 50
),
numbered_users AS (
  SELECT id, row_number() OVER (ORDER BY email) AS un
  FROM public.profiles
  WHERE email LIKE 'seed_turista_%@xitty.local'
),
review_pool AS (
  SELECT
    p.id AS place_id, u.id AS user_id,
    ('x' || substr(md5(p.id::text || u.id::text || 'v2'), 1, 8))::bit(32)::int AS h
  FROM numbered_places p CROSS JOIN numbered_users u
  WHERE ((p.pn * 7 + u.un * 3) % 5) IN (2, 3, 4)  -- complementary picks
)
INSERT INTO public.reviews (place_id, user_id, rating, comment, created_at)
SELECT
  rp.place_id, rp.user_id,
  CASE
    WHEN (abs(rp.h) % 100) < 55 THEN 5
    WHEN (abs(rp.h) % 100) < 82 THEN 4
    WHEN (abs(rp.h) % 100) < 93 THEN 3
    WHEN (abs(rp.h) % 100) < 98 THEN 2
    ELSE 1
  END,
  CASE WHEN (abs(rp.h / 100) % 12) = 0 THEN NULL ELSE
    (ARRAY[
      'Recomendado, calidad real y atención excelente.',
      'Una experiencia muy agradable, repetiremos pronto.',
      'Buen sitio, vale la pena visitarlo.',
      'Algunas mejoras posibles pero la pasamos bien.',
      'Definitivamente uno de mis lugares favoritos en Barranquilla.',
      'Bastante completo, comida y servicio muy bien.',
      'Espectacular, no esperaba que estuviera tan bueno.',
      'Buen ambiente, buena música y atención correcta.',
      'Lo recomiendo para una salida tranquila.',
      'Variedad y precio, nada se le critica.',
      'Volveremos sin dudarlo, todo cinco estrellas.',
      'Atención de primera, lo recomiendo cien por ciento.',
      'Sabor caribe auténtico, una delicia.',
      'Ambiente fresco y servicio al detalle.',
      'Buen lugar para grupos y familias.',
      'Los precios son razonables para la calidad ofrecida.',
      'Una de mis paradas obligatorias cuando visito Barranquilla.',
      'Un poco lleno los fines de semana pero vale la pena la espera.',
      'Excelente relación precio-calidad.',
      'Súper recomendado para una primera visita.'
    ])[1 + (abs(rp.h / 100) % 20)]
  END,
  now() - (random() * interval '365 days')
FROM review_pool rp
ON CONFLICT (place_id, user_id) DO NOTHING;

-- ============================================================================
-- B) +150 RESEÑAS DE EXPERIENCIAS
-- ============================================================================

INSERT INTO public.experience_reviews (experience_id, user_id, rating, comment, created_at)
SELECT
  e.id, u.id,
  CASE
    WHEN (abs(('x' || substr(md5(e.id::text || u.id::text), 1, 8))::bit(32)::int) % 100) < 65 THEN 5
    WHEN (abs(('x' || substr(md5(e.id::text || u.id::text), 1, 8))::bit(32)::int) % 100) < 88 THEN 4
    WHEN (abs(('x' || substr(md5(e.id::text || u.id::text), 1, 8))::bit(32)::int) % 100) < 97 THEN 3
    ELSE 2
  END,
  (ARRAY[
    'Excelente experiencia, totalmente recomendada para visitantes y locales.',
    'Una de las mejores actividades de Barranquilla. Volveremos.',
    'El guía fue increíble, súper conocedor y carismático.',
    'Bien organizado, cada minuto valió la pena.',
    'La pasamos genial, repetiría sin dudar con amigos.',
    'Cumple lo prometido y más, recomendado al 100%.',
    'Muy bien estructurada, ideal para conocer la ciudad.',
    'Aprendimos un montón sobre la cultura local. Imperdible.',
    'Grupos pequeños permiten una atención personalizada.',
    'Una experiencia auténtica que muestra lo mejor del Caribe.',
    'Vale cada peso. Súper profesional el equipo.',
    'Hay cosas mejorables pero la vibra es genial.',
    'Recomendado para quienes buscan algo diferente.',
    'Un imprescindible si vienes a Barranquilla.',
    'Increíble del principio al fin.'
  ])[1 + (abs(('x' || substr(md5(e.id::text || u.id::text || 'c'), 1, 8))::bit(32)::int) % 15)],
  now() - (random() * interval '180 days')
FROM public.experiences e
CROSS JOIN (
  SELECT id FROM public.profiles WHERE email LIKE 'seed_turista_%@xitty.local'
) u
WHERE NOT EXISTS (
  SELECT 1 FROM public.experience_reviews er
  WHERE er.experience_id = e.id AND er.user_id = u.id
)
AND (abs(hashtext(e.id::text || u.id::text || 'pick')) % 100) < 22
ON CONFLICT (experience_id, user_id) DO NOTHING;

-- ============================================================================
-- C) +180 CUPOS FUTUROS (días 50-110)
-- ============================================================================

DO $more_slots$
DECLARE
  exp_record RECORD;
  future_days INT[] := ARRAY[50, 60, 75, 88, 100, 110];
  d INT;
  cap SMALLINT;
BEGIN
  FOR exp_record IN SELECT id FROM public.experiences LOOP
    FOREACH d IN ARRAY future_days LOOP
      cap := (10 + (floor(random() * 6)))::SMALLINT;
      INSERT INTO public.experience_slots (experience_id, starts_at, capacity, is_active)
      VALUES (
        exp_record.id,
        date_trunc('hour', now() + (d || ' days')::interval) + interval '17 hours',
        cap, true
      )
      ON CONFLICT (experience_id, starts_at) DO NOTHING;
    END LOOP;
  END LOOP;
END
$more_slots$;

-- ============================================================================
-- D) +150 RESERVAS CONFIRMADAS EN LOS NUEVOS CUPOS
-- ============================================================================

DO $more_reservations$
DECLARE
  slot_record RECORD;
  reservation_count INT;
  participants_value SMALLINT;
  used_participants INT;
  user_offset INT;
  user_id_value UUID;
  exp_price INT;
  i INT;
BEGIN
  FOR slot_record IN
    SELECT s.id AS slot_id, s.experience_id, s.starts_at, s.capacity, e.price_cop
    FROM public.experience_slots s
    JOIN public.experiences e ON e.id = s.experience_id
    WHERE s.starts_at > now() + interval '45 days'
      AND s.created_at > now() - interval '5 minutes'
    ORDER BY s.experience_id, s.starts_at
  LOOP
    exp_price := slot_record.price_cop;
    used_participants := 0;
    reservation_count := 1 + (floor(random() * 3))::INT;

    FOR i IN 1..reservation_count LOOP
      participants_value := (1 + floor(random() * 3))::SMALLINT;
      IF used_participants + participants_value > slot_record.capacity - 2 THEN EXIT; END IF;
      user_offset := ((abs(hashtext(slot_record.slot_id::text || 'v2' || i::text)) % 30) + 1);
      SELECT id INTO user_id_value FROM public.profiles
      WHERE email = 'seed_turista_' || lpad(user_offset::text, 3, '0') || '@xitty.local';

      INSERT INTO public.experience_reservations
        (slot_id, experience_id, user_id, participants, total_price_cop, status, created_at)
      VALUES
        (slot_record.slot_id, slot_record.experience_id, user_id_value,
         participants_value, exp_price * participants_value,
         'confirmed', now() - (random() * interval '20 days'));
      used_participants := used_participants + participants_value;
    END LOOP;
  END LOOP;
END
$more_reservations$;

-- ============================================================================
-- E) +50 PROMOCIONES ACTIVAS
-- ============================================================================

WITH picked_places AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY random()) AS rn
  FROM public.places ORDER BY random() LIMIT 50
),
title_pool AS (
  SELECT ARRAY[
    'Combo 15% off entre semana',
    'Descuento veterano local 20%',
    'Cumple en el mes 25% off',
    'Reserva anticipada 10% off',
    'Lunes locos 30% en bebidas',
    'Combo familiar viernes',
    'Promo redes sociales 15%',
    'Membresía Xitty 18% off',
    'Almuerzo ejecutivo descuento',
    'Hora valle medio precio'
  ] AS titles,
  ARRAY[
    'Combo especial de lunes a jueves con 15% de descuento adicional en la cuenta.',
    'Si eres local de Barranquilla, presenta tu cédula y obtén 20% off automáticamente.',
    'Cumples años este mes? Te invitamos con 25% de descuento durante todo el mes.',
    'Reserva con 7+ días de anticipación y recibe 10% off automático al confirmar.',
    'Cada lunes 30% de descuento en bebidas seleccionadas. Imperdible para foodies.',
    'Combo familiar todos los viernes con descuento y bebida gratis para niños.',
    'Síguenos en redes y obtén 15% off en tu próxima visita. Solo presenta el follow.',
    'Miembros de Xitty Club tienen 18% off siempre. Inscríbete gratis en la app.',
    'Almuerzo ejecutivo de lunes a viernes con 20% off sobre cuenta total.',
    'Promo hora valle de 3pm a 6pm: todos los productos a mitad de precio.'
  ] AS descs
)
INSERT INTO public.promotions (place_id, title, description, discount_percentage, starts_at, ends_at, is_active)
SELECT
  pp.id,
  tp.titles[((pp.rn::int - 1) % 10) + 1],
  tp.descs[((pp.rn::int - 1) % 10) + 1],
  ((10 + (pp.rn::int % 6) * 5))::smallint,
  now() - ((pp.rn::int % 14 + 1) || ' days')::interval,
  now() + ((pp.rn::int % 30 + 15) || ' days')::interval,
  true
FROM picked_places pp, title_pool tp;

-- ============================================================================
-- F) +5000 INTERACCIONES MICROSITE (total ~10K)
-- ============================================================================

INSERT INTO public.microsite_interactions (place_id, user_id, interaction_type, promo_id, created_at)
SELECT
  (
    SELECT id FROM (
      SELECT id FROM public.places WHERE owner_id IS NOT NULL
      UNION ALL SELECT id FROM public.places WHERE owner_id IS NOT NULL
      UNION ALL SELECT id FROM public.places WHERE owner_id IS NOT NULL
      UNION ALL SELECT id FROM public.places WHERE owner_id IS NOT NULL
      UNION ALL SELECT id FROM public.places WHERE owner_id IS NOT NULL
      UNION ALL SELECT id FROM public.places
    ) sub ORDER BY random() LIMIT 1
  ),
  CASE WHEN random() < 0.30 THEN
    (SELECT id FROM public.profiles WHERE email LIKE 'seed_turista_%@xitty.local' ORDER BY random() LIMIT 1)
  ELSE NULL END,
  CASE
    WHEN r < 0.60 THEN 'profile_view'
    WHEN r < 0.72 THEN 'directions_click'
    WHEN r < 0.82 THEN 'call_click'
    WHEN r < 0.92 THEN 'whatsapp_click'
    WHEN r < 0.97 THEN 'reservation_click'
    ELSE 'promo_view'
  END,
  NULL::uuid,
  (
    date_trunc('day', now() - (
      CASE
        WHEN r2 < 0.60 THEN (random() * 30)::int * interval '1 day'
        WHEN r2 < 0.90 THEN (30 + random() * 30)::int * interval '1 day'
        ELSE (60 + random() * 30)::int * interval '1 day'
      END
    ))
    + (
      CASE
        WHEN r3 < 0.35 THEN (12 + floor(random() * 3))::int * interval '1 hour'
        WHEN r3 < 0.70 THEN (18 + floor(random() * 5))::int * interval '1 hour'
        WHEN r3 < 0.75 THEN floor(random() * 8)::int * interval '1 hour'
        ELSE (8 + floor(random() * 10))::int * interval '1 hour'
      END
    )
    + floor(random() * 60)::int * interval '1 minute'
  )
FROM (
  SELECT n, random() AS r, random() AS r2, random() AS r3
  FROM generate_series(1, 5000) AS gs(n)
) src;

UPDATE public.microsite_interactions mi
SET promo_id = (
  SELECT p.id FROM public.promotions p
  WHERE p.place_id = mi.place_id AND p.is_active = true
  ORDER BY random() LIMIT 1
)
WHERE mi.interaction_type = 'promo_view' AND mi.promo_id IS NULL;

-- ============================================================================
-- G) +200 FOTOS EN LOS TOP 20 PLACES (galería rica)
-- ============================================================================

DO $more_photos$
DECLARE
  place_record RECORD;
  photo_pool TEXT[] := ARRAY[
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80',
    'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1200&q=80',
    'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=1200&q=80',
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1200&q=80',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80',
    'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=1200&q=80',
    'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&q=80',
    'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=1200&q=80',
    'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=1200&q=80'
  ];
  start_order INT;
  i INT;
BEGIN
  -- Top 20 places by interactions, give each 8-12 extra photos
  FOR place_record IN
    SELECT p.id, COUNT(mi.id) AS interaction_count,
           (SELECT MAX(display_order) FROM public.place_photos WHERE place_id = p.id) AS max_order
    FROM public.places p
    LEFT JOIN public.microsite_interactions mi ON mi.place_id = p.id
    WHERE p.created_at > now() - interval '24 hours'
    GROUP BY p.id
    ORDER BY interaction_count DESC NULLS LAST
    LIMIT 20
  LOOP
    start_order := COALESCE(place_record.max_order, -1) + 1;
    FOR i IN 1..(8 + (floor(random() * 5))::INT) LOOP
      INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order)
      VALUES (
        place_record.id,
        photo_pool[((start_order + i - 1) % array_length(photo_pool, 1)) + 1],
        'Foto adicional ' || i,
        false,
        start_order + i - 1
      );
    END LOOP;
  END LOOP;
END
$more_photos$;

-- ============================================================================
-- H) TAGS ENRIQUECIDOS POR CATEGORÍA
-- ============================================================================
-- Agrega tags comunes para que los filtros encuentren muchos resultados.

UPDATE public.places
SET tags = ARRAY(SELECT DISTINCT t FROM unnest(
  tags || ARRAY['aire acondicionado','wifi','parqueadero','accesible']::text[]
) AS t)
WHERE created_at > now() - interval '24 hours';

UPDATE public.places SET tags = ARRAY(SELECT DISTINCT t FROM unnest(
  tags || ARRAY['vegetariano','vegano','kid-friendly','reservas','delivery']::text[]
) AS t)
WHERE category_id = (SELECT id FROM public.categories WHERE slug = 'restaurantes')
  AND created_at > now() - interval '24 hours';

UPDATE public.places SET tags = ARRAY(SELECT DISTINCT t FROM unnest(
  tags || ARRAY['piscina','spa','desayuno incluido','pet-friendly','gimnasio']::text[]
) AS t)
WHERE category_id = (SELECT id FROM public.categories WHERE slug = 'hoteles')
  AND created_at > now() - interval '24 hours';

UPDATE public.places SET tags = ARRAY(SELECT DISTINCT t FROM unnest(
  tags || ARRAY['vista al mar','familiar','snacks','sombrillas','duchas']::text[]
) AS t)
WHERE category_id = (SELECT id FROM public.categories WHERE slug = 'playas')
  AND created_at > now() - interval '24 hours';

UPDATE public.places SET tags = ARRAY(SELECT DISTINCT t FROM unnest(
  tags || ARRAY['terraza','musica en vivo','21+','reservas','foodie']::text[]
) AS t)
WHERE category_id = (SELECT id FROM public.categories WHERE slug = 'bares-vida-nocturna')
  AND created_at > now() - interval '24 hours';

UPDATE public.places SET tags = ARRAY(SELECT DISTINCT t FROM unnest(
  tags || ARRAY['historico','guiado','accesible','instagrameable','familiar']::text[]
) AS t)
WHERE category_id IN (
  SELECT id FROM public.categories WHERE slug IN ('cultura','sitios-turisticos')
)
  AND created_at > now() - interval '24 hours';

-- ============================================================================
-- I) EDGE CASES (para testear UIs específicas)
-- ============================================================================

-- 1) Place con CERO reseñas y CERO fotos (probar empty state)
INSERT INTO public.places (
  name, description, address, latitude, longitude, phone, price_range, category_id, tags
)
VALUES (
  'El Recién Abierto · Sin Reseñas Aún',
  'Recién abierto este mes. Todavía no tiene reseñas ni fotos. Perfecto para testear los empty states de la UI: la galería debería mostrar placeholder, la sección de reseñas un "Sé el primero en reseñar", y el rating estrella vacío.',
  'Carrera 50 con Calle 50, El Prado',
  10.9885, -74.8045, '+57 60 5 350 1234', 2,
  (SELECT id FROM public.categories WHERE slug = 'restaurantes'),
  ARRAY['nuevo','recién abierto','sin reseñas','test empty state']
)
ON CONFLICT DO NOTHING;

-- 2) Place INACTIVO (is_active=false) — solo visible para admin
INSERT INTO public.places (
  name, description, address, latitude, longitude,
  category_id, is_active, tags
)
VALUES (
  'Cerrado Temporalmente · Bar Antiguo',
  'Este lugar está temporalmente cerrado por remodelación. Se usa para testear que el frontend correctamente oculta places con is_active=false del directorio público, pero un admin sí los puede ver y reactivar.',
  'Carrera 44 con Calle 80, Boston',
  10.9985, -74.8055,
  (SELECT id FROM public.categories WHERE slug = 'bares-vida-nocturna'),
  false,
  ARRAY['cerrado','testing','inactive','test admin only']
)
ON CONFLICT DO NOTHING;

-- 3) Place con rating PERFECTO (5.0★) — top en ranking
INSERT INTO public.places (
  name, description, address, latitude, longitude, phone, price_range, category_id, tags
)
VALUES (
  'El 5 Estrellas · Sin Defectos',
  'Lugar legendario con calificación perfecta. Solo recibe reseñas de 5 estrellas. Sirve para testear cómo se muestra un lugar con rating máximo y aparición top en el ranking.',
  'Carrera 53 con Calle 76, Alto Prado',
  11.0015, -74.8105, '+57 60 5 379 5555', 4,
  (SELECT id FROM public.categories WHERE slug = 'restaurantes'),
  ARRAY['top rating','imperdible','5 estrellas','premium']
)
ON CONFLICT DO NOTHING;

-- Insert 25 reseñas de 5 estrellas para el "El 5 Estrellas"
INSERT INTO public.reviews (place_id, user_id, rating, comment, created_at)
SELECT
  (SELECT id FROM public.places WHERE name = 'El 5 Estrellas · Sin Defectos' ORDER BY created_at DESC LIMIT 1),
  u.id, 5,
  (ARRAY[
    'Perfecto en todo, una verdadera obra maestra culinaria.',
    'Cinco estrellas merecidas. Volveré las veces que pueda.',
    'No hay defecto que señalar, todo de lujo.',
    'El sitio más impecable de Barranquilla. Imperdible.',
    'Una experiencia de otro nivel, recomendado al 100%.'
  ])[1 + (abs(hashtext(u.id::text)) % 5)],
  now() - (random() * interval '90 days')
FROM (
  SELECT id FROM public.profiles WHERE email LIKE 'seed_turista_%@xitty.local' LIMIT 25
) u
ON CONFLICT (place_id, user_id) DO NOTHING;

-- 4) Place con rating BAJO (~2.0★)
INSERT INTO public.places (
  name, description, address, latitude, longitude, phone, price_range, category_id, tags
)
VALUES (
  'El Decepcionante · Mejor Pasar de Largo',
  'Lugar con baja calificación que ilustra cómo se muestra un place con malas reseñas. Útil para testear UI de rating bajo y filtros.',
  'Calle 30 con Carrera 45, Barrio Abajo',
  10.9785, -74.7995, '+57 60 5 340 9999', 1,
  (SELECT id FROM public.categories WHERE slug = 'restaurantes'),
  ARRAY['flojo','rating bajo','testing']
)
ON CONFLICT DO NOTHING;

INSERT INTO public.reviews (place_id, user_id, rating, comment, created_at)
SELECT
  (SELECT id FROM public.places WHERE name = 'El Decepcionante · Mejor Pasar de Largo' ORDER BY created_at DESC LIMIT 1),
  u.id,
  (ARRAY[1, 2, 2, 2, 3])[1 + (abs(hashtext(u.id::text)) % 5)],
  (ARRAY[
    'Mala experiencia, esperaba mucho más.',
    'No vuelvo. Servicio muy lento y comida fría.',
    'Decepcionante en todos los aspectos.',
    'Hay opciones mucho mejores por la zona.',
    'Lo único rescatable es la ubicación.'
  ])[1 + (abs(hashtext(u.id::text)) % 5)],
  now() - (random() * interval '120 days')
FROM (
  SELECT id FROM public.profiles WHERE email LIKE 'seed_turista_%@xitty.local' LIMIT 15
) u
ON CONFLICT (place_id, user_id) DO NOTHING;

-- ============================================================================
-- J) +4 SEMANAS HISTÓRICAS DE FEATURED + LOCAL_PICKS
-- ============================================================================

DO $historical_curation$
DECLARE
  week_offset INT;
  picked_id UUID;
BEGIN
  FOR week_offset IN 3..6 LOOP
    -- 2 featured por semana
    FOR i IN 1..2 LOOP
      SELECT id INTO picked_id FROM public.places
      WHERE created_at > now() - interval '24 hours'
      ORDER BY random() LIMIT 1;

      INSERT INTO public.featured_content (
        place_id, curator_name, custom_title, custom_description, hero_image_url,
        week_starts_at, week_ends_at, position, is_active, created_by
      )
      VALUES (
        picked_id,
        (ARRAY['Equipo Xitty','Maria Curadora','Andres Editorial'])[1 + (abs(hashtext(week_offset::text || i::text)) % 3)],
        'Destacado hace ' || week_offset || ' semanas',
        'Esta semana destacamos este lugar especial de Barranquilla por su propuesta única y la consistencia del servicio que ofrece a sus visitantes.',
        (ARRAY[
          'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80',
          'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80',
          'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80',
          'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1200&q=80'
        ])[1 + (abs(hashtext(picked_id::text)) % 4)],
        date_trunc('week', now() - (week_offset || ' weeks')::interval),
        date_trunc('week', now() - (week_offset || ' weeks')::interval) + interval '7 days',
        (i - 1)::smallint,
        true,
        (SELECT id FROM public.profiles WHERE email = 'seed_admin_001@xitty.local')
      );
    END LOOP;

    -- 2 local_picks por semana
    FOR i IN 1..2 LOOP
      SELECT id INTO picked_id FROM public.places
      WHERE created_at > now() - interval '24 hours'
      ORDER BY random() LIMIT 1;

      INSERT INTO public.local_picks (
        place_id, curator_name, pick_tag, short_pitch, hero_image_url,
        week_starts_at, week_ends_at, position, is_active, created_by
      )
      VALUES (
        picked_id,
        (ARRAY['Andrea Local','Carlos Conoce','Mariana del Norte','Diego Caribe'])[1 + (abs(hashtext(week_offset::text || i::text || 'l')) % 4)],
        (ARRAY['favorito_local','secreto','autentico'])[1 + (abs(hashtext(week_offset::text || i::text || 't')) % 3)],
        'Una recomendación local de hace ' || week_offset || ' semanas. Si quieres comer como un barranquillero, este es el sitio.',
        (ARRAY[
          'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80',
          'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80',
          'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1200&q=80'
        ])[1 + (abs(hashtext(picked_id::text || 'l')) % 3)],
        date_trunc('week', now() - (week_offset || ' weeks')::interval),
        date_trunc('week', now() - (week_offset || ' weeks')::interval) + interval '7 days',
        (i - 1)::smallint,
        true,
        (SELECT id FROM public.profiles WHERE email = 'seed_admin_002@xitty.local')
      );
    END LOOP;
  END LOOP;
END
$historical_curation$;

-- ============================================================================
-- K) 3 TURISTAS VIP CON ACTIVIDAD MASIVA
-- ============================================================================
-- Marca a turistas 001, 002, 003 como "power users" agregando favoritos masivos.

INSERT INTO public.favorites (user_id, place_id, created_at)
SELECT
  u.id, p.id, now() - (random() * interval '120 days')
FROM (
  SELECT id FROM public.profiles
  WHERE email IN ('seed_turista_001@xitty.local', 'seed_turista_002@xitty.local', 'seed_turista_003@xitty.local')
) u
CROSS JOIN public.places p
WHERE p.created_at > now() - interval '24 hours'
  AND random() < 0.6
ON CONFLICT (user_id, place_id) DO NOTHING;

-- ============================================================================
-- L) PROMOCIONES PARA LOS PLACES SIN PROMO ACTIVA
-- ============================================================================
-- Asegura que al menos cada place tiene una promo (para ver el badge en home).

INSERT INTO public.promotions (place_id, title, description, discount_percentage, starts_at, ends_at, is_active)
SELECT
  p.id,
  'Promo bienvenida 10% off',
  'Promoción de bienvenida con 10% de descuento. Válida en tu primera visita. Presenta el código en caja.',
  10::smallint,
  now() - interval '5 days',
  now() + interval '60 days',
  true
FROM public.places p
WHERE p.created_at > now() - interval '24 hours'
  AND p.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.promotions pr
    WHERE pr.place_id = p.id AND pr.is_active = true
      AND now() BETWEEN pr.starts_at AND pr.ends_at
  );

-- ============================================================================
-- M) REFRESH AGREGADOS Y RANKING
-- ============================================================================

UPDATE public.places p
SET average_rating = COALESCE(sub.avg, 0), total_reviews = COALESCE(sub.cnt, 0)
FROM (
  SELECT place_id, ROUND(AVG(rating)::numeric, 1) AS avg, COUNT(*) AS cnt
  FROM public.reviews GROUP BY place_id
) sub WHERE p.id = sub.place_id;

UPDATE public.experiences e
SET average_rating = COALESCE(sub.avg, 0), total_reviews = COALESCE(sub.cnt, 0)
FROM (
  SELECT experience_id, ROUND(AVG(rating)::numeric, 1) AS avg, COUNT(*) AS cnt
  FROM public.experience_reviews GROUP BY experience_id
) sub WHERE e.id = sub.experience_id;

SELECT public.refresh_place_rankings();

-- ============================================================================
-- N) HERO ADS — marca 5 promos como hero para el slot #1 del home
-- ============================================================================
-- Defensive: only runs if the hero columns exist (added by the
-- 20260617000002_extend_promotions_for_hero migration). This lets older
-- snapshots load the seed without error.

DO $hero$
DECLARE
  has_hero boolean;
  hero_images text[] := ARRAY[
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600&q=80',
    'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1600&q=80',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1600&q=80',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1600&q=80',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1600&q=80'
  ];
  priorities smallint[] := ARRAY[100, 80, 60, 40, 20]::smallint[];
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'promotions'
      AND column_name  = 'is_hero'
  ) INTO has_hero;

  IF NOT has_hero THEN
    RAISE NOTICE 'Skipping hero seed: promotions.is_hero column not present.';
    RETURN;
  END IF;

  WITH picked AS (
    SELECT id, row_number() OVER (ORDER BY random()) AS rn
    FROM public.promotions
    WHERE is_active = true
      AND now() BETWEEN starts_at AND ends_at
    LIMIT 5
  )
  UPDATE public.promotions p
     SET is_hero        = true,
         hero_priority  = priorities[picked.rn::int],
         hero_image_url = hero_images[picked.rn::int]
    FROM picked
   WHERE p.id = picked.id;

  RAISE NOTICE 'Hero promotions tagged: %', (SELECT count(*) FROM public.promotions WHERE is_hero = true);
END
$hero$;

-- ============================================================================
-- ✅ SEED v2 COMPLETO
-- ============================================================================
-- Verificar:
--   SELECT 'profiles' tabla, count(*) FROM public.profiles WHERE email LIKE 'seed_%@xitty.local'
--   UNION ALL SELECT 'places',           count(*) FROM public.places
--   UNION ALL SELECT 'place_photos',     count(*) FROM public.place_photos
--   UNION ALL SELECT 'reviews',          count(*) FROM public.reviews
--   UNION ALL SELECT 'favorites',        count(*) FROM public.favorites
--   UNION ALL SELECT 'experiences',      count(*) FROM public.experiences
--   UNION ALL SELECT 'exp_slots',        count(*) FROM public.experience_slots
--   UNION ALL SELECT 'exp_reservations', count(*) FROM public.experience_reservations
--   UNION ALL SELECT 'exp_reviews',      count(*) FROM public.experience_reviews
--   UNION ALL SELECT 'promotions',       count(*) FROM public.promotions WHERE is_active = true
--   UNION ALL SELECT 'featured_content', count(*) FROM public.featured_content
--   UNION ALL SELECT 'local_picks',      count(*) FROM public.local_picks
--   UNION ALL SELECT 'interactions',     count(*) FROM public.microsite_interactions
--   UNION ALL SELECT 'sponsored',        count(*) FROM public.places WHERE is_sponsored = true;
-- ============================================================================
