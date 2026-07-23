-- ============================================================================
-- XITTY · FULL SEED · v1
-- ============================================================================
-- Genera ~42 usuarios + 50 places + 30 experiences + ~5000 interactions +
-- reseñas, reservas, promos, etc. Todo con datos realistas de Barranquilla.
--
-- USO:
--   1. Abrir Supabase SQL Editor (Dashboard > SQL Editor).
--   2. Pegar este archivo COMPLETO y ejecutar.
--   3. Tarda ~30-60s. Si algo falla a mitad, se puede re-ejecutar parcialmente
--      por sección (los INSERT usan ON CONFLICT donde es posible).
--
-- CONVENCIÓN DE EMAILS:
--   seed_turista_001 .. seed_turista_030 @xitty.local  (rol user)
--   seed_dueno_001   .. seed_dueno_010   @xitty.local  (rol business)
--   seed_admin_001   .. seed_admin_002   @xitty.local  (rol admin)
--
-- PASSWORD COMÚN: xitty-seed-2026
--
-- NOTA: Las secciones 2 (places) y 5 (promotions/featured/local_picks)
--       crearán filas duplicadas si re-ejecutas. Si quieres reset limpio,
--       trunca primero (script de cleanup al final, comentado).
-- ============================================================================

-- Asegurar pgcrypto para crypt() + gen_salt()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- SECTION 1: Users (auth.users + auth.identities + profiles + roles + prefs)
-- ============================================================================

DO $seed_users$
DECLARE
  v_email     text;
  v_full_name text;
  v_phone     text;
  v_meta      jsonb;
  v_user_id   uuid;
  i           int;
  first_names text[] := ARRAY[
    'María','Juan','Camila','Andrés','Valentina','Sebastián','Isabella','Mateo','Sofía','Daniel',
    'Lucía','David','Mariana','Santiago','Antonella','Felipe','Renata','Tomás','Salomé','Diego',
    'Manuela','Nicolás','Sara','Emilio','Catalina','Alejandro','Laura','Gabriel','Helena','Joaquín'
  ];
  last_names text[] := ARRAY[
    'Gómez','Martínez','Rodríguez','Pérez','García','Sánchez','López','Romero','Torres','Vargas',
    'Castro','Jiménez','Ortiz','Rivera','Mendoza','Reyes','Cruz','Flores','Ramírez','Acosta',
    'Salazar','Vega','Rojas','Castillo','Cortés','Aguilar','Medina','Guerrero','Núñez','Silva'
  ];
  business_names text[] := ARRAY[
    'Cocina Caribe Asociados','Sitios Turísticos del Norte','Bares La Concepción S.A.S.',
    'Aventuras Xitty Operadores','Hoteles Estelar Caribe','Playa & Mar Operadores',
    'Cultura Carnaval Producciones','Centro Comercial Plaza Mar','EcoTours Magdalena',
    'Deportes Náuticos Salgar'
  ];
  admin_names text[] := ARRAY['Andrea Gestora','Carlos Editorial'];
BEGIN
  -- ---------------------- 30 turistas ----------------------
  FOR i IN 1..30 LOOP
    v_email     := 'seed_turista_' || lpad(i::text, 3, '0') || '@xitty.local';
    v_full_name := first_names[i] || ' ' || last_names[i];
    v_phone     := '+57 300 ' || lpad((1000000 + i*7)::text, 7, '0');
    v_meta      := jsonb_build_object('full_name', v_full_name, 'phone', v_phone);

    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) VALUES (
        '00000000-0000-0000-0000-000000000000'::uuid,
        gen_random_uuid(),
        'authenticated', 'authenticated',
        v_email,
        crypt('xitty-seed-2026', gen_salt('bf')),
        now() - (random() * interval '180 days'),
        '{"provider":"email","providers":["email"]}'::jsonb,
        v_meta,
        now() - (random() * interval '180 days'), now(),
        '', '', '', ''
      ) RETURNING id INTO v_user_id;

      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), v_user_id,
        jsonb_build_object(
          'sub', v_user_id::text,
          'email', v_email,
          'email_verified', true,
          'phone_verified', false
        ),
        'email', v_user_id::text,
        NULL, now(), now()
      );
    END IF;
  END LOOP;

  -- ---------------------- 10 dueños ----------------------
  FOR i IN 1..10 LOOP
    v_email     := 'seed_dueno_' || lpad(i::text, 3, '0') || '@xitty.local';
    v_full_name := business_names[i];
    v_phone     := '+57 60 5 ' || lpad((3000000 + i*23)::text, 7, '0');
    v_meta      := jsonb_build_object('full_name', v_full_name, 'phone', v_phone);

    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) VALUES (
        '00000000-0000-0000-0000-000000000000'::uuid,
        gen_random_uuid(),
        'authenticated', 'authenticated',
        v_email,
        crypt('xitty-seed-2026', gen_salt('bf')),
        now() - (random() * interval '200 days'),
        '{"provider":"email","providers":["email"]}'::jsonb,
        v_meta,
        now() - (random() * interval '200 days'), now(),
        '', '', '', ''
      ) RETURNING id INTO v_user_id;

      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), v_user_id,
        jsonb_build_object(
          'sub', v_user_id::text,
          'email', v_email,
          'email_verified', true,
          'phone_verified', false
        ),
        'email', v_user_id::text,
        NULL, now(), now()
      );
    END IF;
  END LOOP;

  -- ---------------------- 2 admins ----------------------
  FOR i IN 1..2 LOOP
    v_email     := 'seed_admin_' || lpad(i::text, 3, '0') || '@xitty.local';
    v_full_name := admin_names[i];
    v_phone     := '+57 310 ' || lpad((9000000 + i*17)::text, 7, '0');
    v_meta      := jsonb_build_object('full_name', v_full_name, 'phone', v_phone);

    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) VALUES (
        '00000000-0000-0000-0000-000000000000'::uuid,
        gen_random_uuid(),
        'authenticated', 'authenticated',
        v_email,
        crypt('xitty-seed-2026', gen_salt('bf')),
        now() - interval '250 days',
        '{"provider":"email","providers":["email"]}'::jsonb,
        v_meta,
        now() - interval '250 days', now(),
        '', '', '', ''
      ) RETURNING id INTO v_user_id;

      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), v_user_id,
        jsonb_build_object(
          'sub', v_user_id::text,
          'email', v_email,
          'email_verified', true,
          'phone_verified', false
        ),
        'email', v_user_id::text,
        NULL, now(), now()
      );
    END IF;
  END LOOP;
END
$seed_users$;

-- ---------------------- profiles ----------------------
INSERT INTO public.profiles (id, email, full_name, phone, role)
SELECT
  u.id,
  u.email,
  u.raw_user_meta_data->>'full_name',
  u.raw_user_meta_data->>'phone',
  CASE
    WHEN u.email LIKE 'seed_turista_%' THEN 'user'
    WHEN u.email LIKE 'seed_dueno_%'   THEN 'business'
    WHEN u.email LIKE 'seed_admin_%'   THEN 'admin'
  END
FROM auth.users u
WHERE u.email LIKE 'seed_%@xitty.local'
ON CONFLICT (id) DO NOTHING;

-- ---------------------- user_roles ----------------------
INSERT INTO public.user_roles (user_id, role)
SELECT id, role
FROM public.profiles
WHERE email LIKE 'seed_%@xitty.local'
ON CONFLICT (user_id, role) DO NOTHING;

-- ---------------------- user_preferences ----------------------
-- ~25 de los 30 turistas tienen preferencias completas
-- (los 5 restantes quedarán sin prefs → /onboarding se dispara para ellos)
INSERT INTO public.user_preferences (
  user_id, traveler_type, budget_min, budget_max,
  available_time, energy_level, companions, wizard_completed
)
SELECT
  p.id,
  (ARRAY['nomada','pareja','familia','negocios','excursion'])[1 + (random() * 4)::int],
  (ARRAY[50000, 80000, 120000, 200000])[1 + (random() * 3)::int],
  (ARRAY[300000, 500000, 800000, 1500000])[1 + (random() * 3)::int],
  (ARRAY['1-3 dias','4-7 dias','+1 semana'])[1 + (random() * 2)::int],
  (ARRAY['baja','media','alta'])[1 + (random() * 2)::int],
  (random() * 4)::int,
  true
FROM public.profiles p
WHERE p.email LIKE 'seed_turista_%@xitty.local'
  AND CAST(substring(p.email FROM 'seed_turista_(\d+)@') AS int) <= 25
ON CONFLICT (user_id) DO NOTHING;

-- ---------------------- preferencias para dueños y admins ----------------------
-- El AuthGate redirige a /onboarding a cualquier usuario sin wizard_completed,
-- sin importar su rol. Por eso marcamos wizard_completed=true para dueños/admins
-- (no usan el wizard de turista, pero deben poder pasar de largo a su panel).
INSERT INTO public.user_preferences (user_id, wizard_completed)
SELECT id, true
FROM public.profiles
WHERE email LIKE 'seed_dueno_%@xitty.local'
   OR email LIKE 'seed_admin_%@xitty.local'
ON CONFLICT (user_id) DO UPDATE SET wizard_completed = true;

-- ---------------------- business_notification_settings ----------------------
INSERT INTO public.business_notification_settings (
  user_id, notify_call_click, notify_whatsapp_click,
  notify_reservation_click, daily_summary
)
SELECT
  p.id,
  true, true, true, true
FROM public.profiles p
WHERE p.email LIKE 'seed_dueno_%@xitty.local'
ON CONFLICT (user_id) DO NOTHING;
-- ============================================================================
-- SECTION 2: Places + place_photos + sponsorships
-- ============================================================================

-- ============================================================================
-- RESTAURANTES (5 places)
-- ============================================================================

INSERT INTO public.places (name, description, address, latitude, longitude, phone, website, price_range, schedule, category_id, owner_id, tags, cta_phone, cta_whatsapp, reservation_url)
VALUES
('La Cueva Restaurante',
 'Emblemático restaurante en el Centro Histórico que perteneció al Grupo de Barranquilla con García Márquez y Cepeda Samudio. Cocina costeña tradicional en un ambiente literario único. Ofrece pescados frescos, mariscos y carnes a la parrilla. Su decoración conserva el espíritu bohemio de los años 50. Una visita obligada para los amantes de la cultura caribeña.',
 'Carrera 43 #59-03, Centro Histórico',
 10.9939, -74.7920,
 '+57 60 5 379 2786',
 'https://lacueva.com.co',
 3,
 '{"monday":"closed","tuesday":"12:00-22:00","wednesday":"12:00-22:00","thursday":"12:00-22:00","friday":"12:00-23:30","saturday":"12:00-23:30","sunday":"12:00-17:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'restaurantes'),
 (SELECT id FROM public.profiles WHERE email = 'seed_dueno_001@xitty.local'),
 ARRAY['comida costeña','literario','centro histórico','tradicional','mariscos'],
 '+57 60 5 379 2786',
 '+57 60 5 379 2786',
 'https://lacueva.com.co/reservas'),

('Bollo Gourmet',
 'Restaurante de cocina caribeña contemporánea ubicado en el corazón de Alto Prado. Famoso por sus bollos rellenos creativos y su ambiente moderno e informal. Maneja productos locales con un toque gourmet. Su patio interior es perfecto para almuerzos al aire libre. Ideal para grupos y reuniones casuales.',
 'Carrera 51B #80-58, Alto Prado',
 11.0033, -74.8104,
 '+57 60 5 358 9912',
 'https://bollogourmet.com.co',
 2,
 '{"monday":"12:00-22:00","tuesday":"12:00-22:00","wednesday":"12:00-22:00","thursday":"12:00-23:00","friday":"12:00-00:00","saturday":"12:00-00:00","sunday":"12:00-21:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'restaurantes'),
 NULL,
 ARRAY['caribeña','moderno','wifi','terraza','familiar'],
 '+57 60 5 358 9912',
 '+57 305 412 6677',
 NULL),

('Comedor 7 Bocas',
 'Punto de referencia para los amantes del pescado fresco en Las Flores. Cocina tradicional de orilla preparada por familias pescadoras. Su sancocho de pescado y arroz de mariscos son legendarios. Ambiente sin pretensiones con vista al río Magdalena. Una experiencia gastronómica auténtica.',
 'Vía 40 #75-110, Las Flores',
 11.0287, -74.7611,
 '+57 60 5 354 1023',
 NULL,
 2,
 '{"monday":"11:00-19:00","tuesday":"11:00-19:00","wednesday":"11:00-19:00","thursday":"11:00-20:00","friday":"11:00-21:00","saturday":"11:00-21:00","sunday":"11:00-20:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'restaurantes'),
 NULL,
 ARRAY['pescado fresco','tradicional','río magdalena','familiar','económico'],
 '+57 60 5 354 1023',
 NULL,
 NULL),

('Cocina 33',
 'Restaurante de autor que mezcla técnicas francesas con ingredientes del Caribe. Ubicado en una casa republicana restaurada en el Prado. Menú degustación cambia mensualmente. Carta de vinos premiada a nivel nacional. Reservación obligatoria los fines de semana.',
 'Carrera 53 #70-95, El Prado',
 10.9970, -74.8050,
 '+57 60 5 369 7733',
 'https://cocina33.com.co',
 4,
 '{"monday":"closed","tuesday":"19:00-23:00","wednesday":"19:00-23:00","thursday":"19:00-23:00","friday":"19:00-00:00","saturday":"19:00-00:00","sunday":"12:00-16:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'restaurantes'),
 NULL,
 ARRAY['fine dining','autor','vinos','romántico','reservación'],
 '+57 60 5 369 7733',
 '+57 320 558 7733',
 'https://cocina33.com.co/reservar'),

('Restaurante Devis',
 'Institución barranquillera fundada en 1962, especializada en mariscos y comida costeña. Su cazuela de mariscos y arroz con coco son los favoritos. Ambiente familiar con servicio tradicional. Ubicado en una zona estratégica del norte de la ciudad. Perfecto para celebraciones familiares.',
 'Carrera 51 #79-115, Riomar',
 11.0061, -74.8121,
 '+57 60 5 360 5544',
 'https://restaurantedevis.com',
 3,
 '{"monday":"11:30-22:00","tuesday":"11:30-22:00","wednesday":"11:30-22:00","thursday":"11:30-22:30","friday":"11:30-23:00","saturday":"11:30-23:00","sunday":"11:30-21:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'restaurantes'),
 NULL,
 ARRAY['mariscos','tradicional','familiar','cazuela','histórico'],
 '+57 60 5 360 5544',
 '+57 60 5 360 5544',
 NULL)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SITIOS TURISTICOS (5 places)
-- ============================================================================

INSERT INTO public.places (name, description, address, latitude, longitude, phone, website, price_range, schedule, category_id, owner_id, tags, cta_phone, cta_whatsapp, reservation_url)
VALUES
('Bocas de Ceniza',
 'Punto donde el río Magdalena desemboca en el mar Caribe, formando un espectáculo natural único. Se accede en un tren turístico que recorre 7 kilómetros sobre el tajamar occidental. Vista panorámica del encuentro entre agua dulce y salada. Ideal para fotografía y observación de fauna marina. Recomendado ir temprano por el calor.',
 'Tajamar Occidental, Las Flores',
 11.0945, -74.8523,
 '+57 60 5 354 8800',
 'https://bocasdeceniza.travel',
 1,
 '{"monday":"06:00-17:00","tuesday":"06:00-17:00","wednesday":"06:00-17:00","thursday":"06:00-17:00","friday":"06:00-17:00","saturday":"06:00-18:00","sunday":"06:00-18:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'sitios-turisticos'),
 (SELECT id FROM public.profiles WHERE email = 'seed_dueno_002@xitty.local'),
 ARRAY['naturaleza','tren','río magdalena','mar caribe','fotografía'],
 '+57 60 5 354 8800',
 '+57 318 765 4321',
 'https://bocasdeceniza.travel/tickets'),

('Castillo de Salgar',
 'Fortaleza colonial española del siglo XIX a las afueras de Barranquilla, en el municipio de Puerto Colombia. Vista privilegiada al mar Caribe y al puerto histórico. Construido para proteger la entrada al río Magdalena. Restaurado como espacio cultural y para eventos. Atardeceres espectaculares.',
 'Calle 1 con Carrera 1, Puerto Colombia',
 10.9889, -74.9633,
 '+57 60 5 309 0011',
 'https://castillosalgar.gov.co',
 1,
 '{"monday":"closed","tuesday":"09:00-17:00","wednesday":"09:00-17:00","thursday":"09:00-17:00","friday":"09:00-18:00","saturday":"09:00-19:00","sunday":"09:00-18:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'sitios-turisticos'),
 NULL,
 ARRAY['colonial','histórico','vista al mar','fotografía','atardecer'],
 NULL,
 NULL,
 NULL),

('Ventana al Mundo',
 'Monumento icónico de Barranquilla inaugurado en 2018, símbolo de modernidad y apertura. Estructura metálica de 47 metros de altura diseñada como un marco hacia el futuro. Se ilumina con espectáculos nocturnos los fines de semana. Plaza con áreas verdes y senderos peatonales. Punto de encuentro popular para fotos.',
 'Vía 40 con Calle 78, Norte',
 11.0211, -74.8089,
 NULL,
 NULL,
 1,
 '{"monday":"24h","tuesday":"24h","wednesday":"24h","thursday":"24h","friday":"24h","saturday":"24h","sunday":"24h"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'sitios-turisticos'),
 NULL,
 ARRAY['monumento','moderno','fotografía','iluminación','gratis'],
 NULL,
 NULL,
 NULL),

('Plaza de la Paz',
 'Plaza central frente a la Catedral Metropolitana María Reina, con la imponente escultura "La Caridad" del maestro Negret. Espacio público de gran simbolismo religioso e histórico. Punto de encuentro para eventos cívicos y religiosos. Rodeada de cafés y bancos. Vista privilegiada de la catedral moderna.',
 'Carrera 46 con Calle 53, Centro',
 10.9925, -74.7958,
 NULL,
 NULL,
 1,
 '{"monday":"06:00-22:00","tuesday":"06:00-22:00","wednesday":"06:00-22:00","thursday":"06:00-22:00","friday":"06:00-23:00","saturday":"06:00-23:00","sunday":"06:00-22:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'sitios-turisticos'),
 NULL,
 ARRAY['catedral','plaza','centro','religioso','arte'],
 NULL,
 NULL,
 NULL),

('Paseo Bolívar',
 'Avenida histórica del Centro de Barranquilla, peatonal en gran parte de su extensión. Rodeada de edificios republicanos restaurados y comercio tradicional. Punto de partida ideal para conocer el casco antiguo. Murales urbanos contemporáneos en sus muros. Vida diurna intensa con vendedores tradicionales.',
 'Paseo Bolívar entre Carreras 38 y 44, Centro Histórico',
 10.9892, -74.7912,
 NULL,
 NULL,
 1,
 '{"monday":"06:00-22:00","tuesday":"06:00-22:00","wednesday":"06:00-22:00","thursday":"06:00-22:00","friday":"06:00-23:00","saturday":"06:00-23:00","sunday":"06:00-21:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'sitios-turisticos'),
 NULL,
 ARRAY['centro histórico','peatonal','arte urbano','comercio','tradicional'],
 NULL,
 NULL,
 NULL)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- BARES VIDA NOCTURNA (5 places)
-- ============================================================================

INSERT INTO public.places (name, description, address, latitude, longitude, phone, website, price_range, schedule, category_id, owner_id, tags, cta_phone, cta_whatsapp, reservation_url)
VALUES
('Frogg Leggs Pub',
 'Pub estilo inglés en pleno corazón de Villa Country, referente de la noche barranquillera desde hace décadas. Cervezas importadas, cocteles clásicos y música rock en vivo los fines de semana. Ambiente íntimo con decoración temática. Especialidad en alitas y hamburguesas gourmet. Punto de reunión de profesionales y jóvenes.',
 'Carrera 51B #82-15, Villa Country',
 11.0048, -74.8127,
 '+57 60 5 357 6601',
 'https://froggleggs.com.co',
 3,
 '{"monday":"closed","tuesday":"17:00-01:00","wednesday":"17:00-01:00","thursday":"17:00-02:00","friday":"17:00-03:00","saturday":"17:00-03:00","sunday":"closed"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'bares-vida-nocturna'),
 (SELECT id FROM public.profiles WHERE email = 'seed_dueno_003@xitty.local'),
 ARRAY['pub','rock','cerveza','música en vivo','wifi'],
 '+57 60 5 357 6601',
 '+57 315 887 6601',
 NULL),

('La Troja',
 'Templo de la salsa en Barranquilla desde 1968, esquina histórica de la 44 con 74. Esquina al aire libre, sin sillas, pura calle y baile. Reúne lo mejor de la salsa antillana y colombiana en vinilo. Visitada por leyenda como Joe Arroyo. Imperdible los viernes y sábados en la noche.',
 'Carrera 44 con Calle 74, Esquina',
 10.9978, -74.7990,
 NULL,
 NULL,
 2,
 '{"monday":"closed","tuesday":"closed","wednesday":"18:00-02:00","thursday":"18:00-02:00","friday":"18:00-04:00","saturday":"18:00-04:00","sunday":"15:00-23:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'bares-vida-nocturna'),
 NULL,
 ARRAY['salsa','tradicional','baile','vinilo','calle'],
 NULL,
 NULL,
 NULL),

('Henry´s Café',
 'Bar restaurante con terraza en la zona rosa de Alto Prado. Música variada, desde crossover hasta electrónica los sábados. Cocteles de autor preparados por mixólogos. Ambiente joven y dinámico. Reservación recomendada los fines de semana.',
 'Calle 80 #51B-21, Alto Prado',
 11.0036, -74.8108,
 '+57 60 5 369 9912',
 'https://henryscafe.co',
 3,
 '{"monday":"closed","tuesday":"17:00-00:00","wednesday":"17:00-00:00","thursday":"17:00-01:00","friday":"17:00-03:00","saturday":"17:00-03:00","sunday":"closed"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'bares-vida-nocturna'),
 NULL,
 ARRAY['terraza','cocteles','crossover','electrónica','zona rosa'],
 '+57 60 5 369 9912',
 '+57 313 559 9912',
 'https://henryscafe.co/reservas'),

('Maddox Discoteca',
 'Discoteca de gran formato con tres ambientes diferenciados: crossover, electrónica y reggaetón. Sistema de sonido y luces de última generación. Eventos con DJs internacionales constantemente. Mesa VIP con servicio premium. La fiesta más grande del norte de la ciudad.',
 'Carrera 53 #79-90, Riomar',
 11.0050, -74.8175,
 '+57 60 5 378 5500',
 'https://maddoxbaq.com',
 4,
 '{"monday":"closed","tuesday":"closed","wednesday":"closed","thursday":"22:00-04:00","friday":"22:00-05:00","saturday":"22:00-05:00","sunday":"closed"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'bares-vida-nocturna'),
 NULL,
 ARRAY['discoteca','electrónica','reggaetón','vip','dj internacional'],
 '+57 60 5 378 5500',
 '+57 301 778 5500',
 'https://maddoxbaq.com/mesas'),

('La Cueva del Champeta',
 'Pequeño bar de barrio dedicado exclusivamente a la champeta criolla y africana. Sound system clásico con picós tradicionales. Ambiente sin pretensiones, popular y auténtico. Decoración con afiches de leyendas del género. Imperdible para conocer la verdadera fiesta caribeña.',
 'Carrera 41 #82-43, La Concepción',
 11.0090, -74.7945,
 '+57 60 5 358 4477',
 NULL,
 1,
 '{"monday":"closed","tuesday":"closed","wednesday":"19:00-01:00","thursday":"19:00-02:00","friday":"19:00-04:00","saturday":"19:00-04:00","sunday":"15:00-22:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'bares-vida-nocturna'),
 NULL,
 ARRAY['champeta','picó','popular','caribeño','económico'],
 '+57 60 5 358 4477',
 '+57 304 558 4477',
 NULL)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- EXPERIENCIAS (5 places)
-- ============================================================================

INSERT INTO public.places (name, description, address, latitude, longitude, phone, website, price_range, schedule, category_id, owner_id, tags, cta_phone, cta_whatsapp, reservation_url)
VALUES
('Tour Carnaval de Barranquilla',
 'Recorrido temático por los lugares emblemáticos del Carnaval, Patrimonio de la Humanidad. Visita a casas de hacedores de disfraces, escuelas de danza y museos. Incluye demostración de cumbia y mapalé. Guía bilingüe especializado en cultura caribeña. Duración aproximada de 4 horas.',
 'Casa del Carnaval, Carrera 54 #49B-39',
 10.9959, -74.7945,
 '+57 60 5 319 7616',
 'https://carnavaldebarranquilla.org',
 2,
 '{"monday":"closed","tuesday":"09:00-15:00","wednesday":"09:00-15:00","thursday":"09:00-15:00","friday":"09:00-15:00","saturday":"09:00-13:00","sunday":"closed"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'experiencias'),
 (SELECT id FROM public.profiles WHERE email = 'seed_dueno_004@xitty.local'),
 ARRAY['carnaval','cultura','guiado','cumbia','patrimonio'],
 '+57 60 5 319 7616',
 '+57 320 999 7616',
 'https://carnavaldebarranquilla.org/tours'),

('Paseo en Yate por el Río Magdalena',
 'Experiencia de 3 horas navegando el majestuoso río Magdalena hasta Bocas de Ceniza. Incluye snacks, bebidas y narración histórica del puerto. Avistamiento de aves y vegetación de manglares. Yates de hasta 20 personas con capitán certificado. Salidas desde el muelle de Las Flores.',
 'Muelle Las Flores, Vía 40',
 11.0287, -74.7611,
 '+57 60 5 369 8800',
 'https://yatesmagdalena.com',
 3,
 '{"monday":"closed","tuesday":"09:00-17:00","wednesday":"09:00-17:00","thursday":"09:00-17:00","friday":"09:00-18:00","saturday":"08:00-19:00","sunday":"08:00-18:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'experiencias'),
 NULL,
 ARRAY['yate','río','naturaleza','aves','guiado'],
 '+57 60 5 369 8800',
 '+57 318 888 8800',
 'https://yatesmagdalena.com/reservar'),

('Clase de Cocina Costeña Auténtica',
 'Aprende a preparar sancocho trifásico, arroz de coco y pescado frito con un chef local. Visita previa al mercado de Barranquillita para escoger ingredientes. Cocina al aire libre estilo rancho. Incluye degustación con vista al patio. Grupos pequeños de máximo 8 personas.',
 'Carrera 38 #74-12, Boston',
 10.9989, -74.7950,
 '+57 60 5 369 4455',
 'https://cocinabaq.com',
 3,
 '{"monday":"closed","tuesday":"10:00-15:00","wednesday":"10:00-15:00","thursday":"10:00-15:00","friday":"10:00-15:00","saturday":"10:00-15:00","sunday":"closed"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'experiencias'),
 NULL,
 ARRAY['gastronomía','clase','mercado','chef','grupos pequeños'],
 '+57 60 5 369 4455',
 '+57 304 778 4455',
 'https://cocinabaq.com/booking'),

('Clases de Cumbia y Mapalé',
 'Talleres de danzas tradicionales del Caribe colombiano impartidos por bailarines profesionales del Carnaval. Música en vivo con tambor alegre y gaita. Vestuario incluido para la práctica. Sesiones de 90 minutos para todos los niveles. Salón con espejos en zona céntrica.',
 'Calle 70 #45-23, Boston',
 10.9985, -74.7960,
 '+57 60 5 358 2244',
 'https://academiamapale.com',
 2,
 '{"monday":"16:00-20:00","tuesday":"16:00-20:00","wednesday":"16:00-20:00","thursday":"16:00-20:00","friday":"16:00-20:00","saturday":"09:00-13:00","sunday":"closed"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'experiencias'),
 NULL,
 ARRAY['danza','cumbia','mapalé','clase','cultural'],
 '+57 60 5 358 2244',
 '+57 312 558 2244',
 NULL),

('City Tour en Chiva Rumbera',
 'Recorrido festivo por los principales puntos turísticos de Barranquilla en chiva tradicional decorada. Música tropical en vivo a bordo, aguardiente y refrigerios. Paradas en Ventana al Mundo, Catedral y Vía 40. Duración de 3 horas con guía animador. Salidas nocturnas los fines de semana.',
 'Carrera 53 #75-100, Riomar',
 11.0028, -74.8160,
 '+57 60 5 357 9988',
 'https://chivasbarranquilla.com',
 2,
 '{"monday":"closed","tuesday":"closed","wednesday":"closed","thursday":"19:00-22:00","friday":"19:00-23:00","saturday":"19:00-23:00","sunday":"17:00-21:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'experiencias'),
 NULL,
 ARRAY['chiva','rumba','tour','nocturno','grupo'],
 '+57 60 5 357 9988',
 '+57 313 559 9988',
 'https://chivasbarranquilla.com/comprar')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- HOTELES (5 places)
-- ============================================================================

INSERT INTO public.places (name, description, address, latitude, longitude, phone, website, price_range, schedule, category_id, owner_id, tags, cta_phone, cta_whatsapp, reservation_url)
VALUES
('Hotel Estelar En Alto Prado',
 'Hotel cinco estrellas en la zona financiera de Alto Prado. Habitaciones modernas con vista panorámica de la ciudad. Restaurante de cocina internacional, piscina infinity y spa completo. Centro de convenciones para eventos corporativos. Ideal para viajeros de negocios y placer.',
 'Carrera 51B #79-246, Alto Prado',
 11.0050, -74.8115,
 '+57 60 5 361 8000',
 'https://hotelesestelar.com',
 4,
 '{"monday":"24h","tuesday":"24h","wednesday":"24h","thursday":"24h","friday":"24h","saturday":"24h","sunday":"24h"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'hoteles'),
 (SELECT id FROM public.profiles WHERE email = 'seed_dueno_005@xitty.local'),
 ARRAY['5 estrellas','piscina','spa','negocios','wifi'],
 '+57 60 5 361 8000',
 '+57 318 888 8000',
 'https://hotelesestelar.com/reservar'),

('Hotel El Prado',
 'Histórico hotel construido en 1930, joya arquitectónica colonial declarada monumento nacional. Habitaciones con encanto colonial y modernidad. Jardines tropicales, piscina rodeada de palmeras y restaurante gourmet. Spa con tratamientos caribeños. Una experiencia de hospedaje única en Sudamérica.',
 'Carrera 54 #70-10, El Prado',
 10.9978, -74.8045,
 '+57 60 5 369 7777',
 'https://hotelelprado.com.co',
 4,
 '{"monday":"24h","tuesday":"24h","wednesday":"24h","thursday":"24h","friday":"24h","saturday":"24h","sunday":"24h"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'hoteles'),
 NULL,
 ARRAY['histórico','colonial','piscina','spa','monumento'],
 '+57 60 5 369 7777',
 '+57 315 777 7777',
 'https://hotelelprado.com.co/reservas'),

('Hotel Country International',
 'Hotel de negocios en Villa Country, cerca del aeropuerto y zona comercial. Habitaciones funcionales con escritorio amplio y wifi de alta velocidad. Gym 24 horas, restaurante buffet y cafetería. Salones de reuniones equipados. Excelente relación calidad-precio.',
 'Carrera 52 #75-30, Villa Country',
 11.0010, -74.8085,
 '+57 60 5 368 1900',
 'https://hotelcountrybaq.com',
 3,
 '{"monday":"24h","tuesday":"24h","wednesday":"24h","thursday":"24h","friday":"24h","saturday":"24h","sunday":"24h"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'hoteles'),
 NULL,
 ARRAY['negocios','gym','buffet','wifi','aeropuerto'],
 '+57 60 5 368 1900',
 '+57 320 668 1900',
 'https://hotelcountrybaq.com/booking'),

('Hotel Boutique Casa Riomar',
 'Casa boutique de solo 12 habitaciones en el exclusivo Riomar. Diseño contemporáneo con guiños al Caribe. Patio interior con piscina pequeña y bar. Desayuno gourmet incluido. Atención personalizada y ambiente íntimo. Ideal para parejas.',
 'Carrera 51 #84-20, Riomar',
 11.0078, -74.8133,
 '+57 60 5 378 4400',
 'https://casariomar.co',
 4,
 '{"monday":"24h","tuesday":"24h","wednesday":"24h","thursday":"24h","friday":"24h","saturday":"24h","sunday":"24h"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'hoteles'),
 NULL,
 ARRAY['boutique','romántico','piscina','desayuno','exclusivo'],
 '+57 60 5 378 4400',
 '+57 304 888 4400',
 'https://casariomar.co/reservar'),

('Hostal La Casa del Carnaval',
 'Hostal económico en una casa republicana del centro histórico. Habitaciones privadas y dormitorios compartidos. Cocina común, terraza con hamacas y eventos culturales. Decoración con motivos del Carnaval. Perfecto para mochileros y viajeros jóvenes.',
 'Carrera 41 #58-15, Centro Histórico',
 10.9912, -74.7935,
 '+57 60 5 379 1122',
 'https://hostalcarnaval.com',
 1,
 '{"monday":"24h","tuesday":"24h","wednesday":"24h","thursday":"24h","friday":"24h","saturday":"24h","sunday":"24h"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'hoteles'),
 NULL,
 ARRAY['hostal','mochilero','económico','social','centro'],
 '+57 60 5 379 1122',
 '+57 313 779 1122',
 NULL)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PLAYAS (5 places)
-- ============================================================================

INSERT INTO public.places (name, description, address, latitude, longitude, phone, website, price_range, schedule, category_id, owner_id, tags, cta_phone, cta_whatsapp, reservation_url)
VALUES
('Playa Pradomar',
 'Playa más cercana a Barranquilla, ubicada en Puerto Colombia. Arena dorada y oleaje moderado, ideal para familias. Servicios de carpas, sillas y restaurantes de pescado fresco. Deportes náuticos disponibles los fines de semana. Atardeceres espectaculares sobre el Caribe.',
 'Vía Puerto Colombia, Pradomar',
 10.9978, -74.9778,
 '+57 60 5 309 1100',
 NULL,
 1,
 '{"monday":"07:00-18:00","tuesday":"07:00-18:00","wednesday":"07:00-18:00","thursday":"07:00-18:00","friday":"07:00-19:00","saturday":"06:00-20:00","sunday":"06:00-20:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'playas'),
 (SELECT id FROM public.profiles WHERE email = 'seed_dueno_006@xitty.local'),
 ARRAY['playa','familiar','restaurantes','atardecer','caribe'],
 '+57 60 5 309 1100',
 '+57 318 909 1100',
 NULL),

('Playa Sabanilla',
 'Tradicional playa de pescadores con ambiente local y auténtico. Mariscos frescos en kioscos rústicos a la orilla del mar. Menor afluencia turística que otras playas cercanas. Excelente para caminatas largas en arena firme. Pescadores ofrecen paseos en lancha.',
 'Sabanilla, Puerto Colombia',
 11.0089, -74.9889,
 NULL,
 NULL,
 1,
 '{"monday":"07:00-18:00","tuesday":"07:00-18:00","wednesday":"07:00-18:00","thursday":"07:00-18:00","friday":"07:00-19:00","saturday":"06:00-20:00","sunday":"06:00-20:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'playas'),
 NULL,
 ARRAY['pescadores','auténtico','mariscos','tranquilo','lancha'],
 NULL,
 NULL,
 NULL),

('Playa Salgar',
 'Pequeña playa al pie del Castillo de Salgar, con vista al monumento histórico. Aguas calmadas, ideal para nadar y snorkel cerca de las rocas. Combinable con visita al castillo. Pocos comercios, ambiente íntimo. Recomendado llevar comida propia.',
 'Salgar, Puerto Colombia',
 10.9889, -74.9633,
 NULL,
 NULL,
 1,
 '{"monday":"07:00-17:00","tuesday":"07:00-17:00","wednesday":"07:00-17:00","thursday":"07:00-17:00","friday":"07:00-18:00","saturday":"06:00-19:00","sunday":"06:00-19:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'playas'),
 NULL,
 ARRAY['snorkel','tranquilo','castillo','rocas','íntimo'],
 NULL,
 NULL,
 NULL),

('Playa Puerto Velero',
 'Una de las playas mejor preparadas de la región, con todos los servicios turísticos. Aguas cristalinas y arena blanca finísima. Deportes acuáticos como kitesurf y paddle board. Restaurantes con cocina internacional y bares de playa. Ideal para pasar el día completo.',
 'Puerto Velero, Tubará',
 10.9445, -75.0223,
 '+57 60 5 309 4400',
 'https://puertovelero.com.co',
 2,
 '{"monday":"07:00-18:00","tuesday":"07:00-18:00","wednesday":"07:00-18:00","thursday":"07:00-18:00","friday":"07:00-19:00","saturday":"06:00-20:00","sunday":"06:00-20:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'playas'),
 NULL,
 ARRAY['kitesurf','paddle board','arena blanca','restaurantes','servicios'],
 '+57 60 5 309 4400',
 '+57 320 778 4400',
 'https://puertovelero.com.co/reservas'),

('Playa Caño Dulce',
 'Playa virgen aún poco visitada al norte de Tubará. Manglares y formaciones rocosas hacen un paisaje único. Sin servicios turísticos, ideal para amantes de la naturaleza. Recomendado llevar todo lo necesario. Avistamiento ocasional de tortugas marinas.',
 'Caño Dulce, Tubará',
 10.9234, -75.0589,
 NULL,
 NULL,
 1,
 '{"monday":"24h","tuesday":"24h","wednesday":"24h","thursday":"24h","friday":"24h","saturday":"24h","sunday":"24h"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'playas'),
 NULL,
 ARRAY['virgen','manglares','naturaleza','tortugas','aventura'],
 NULL,
 NULL,
 NULL)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- CULTURA (5 places)
-- ============================================================================

INSERT INTO public.places (name, description, address, latitude, longitude, phone, website, price_range, schedule, category_id, owner_id, tags, cta_phone, cta_whatsapp, reservation_url)
VALUES
('Museo del Caribe',
 'Museo interactivo dedicado a la cultura del Caribe colombiano. Cinco salas temáticas: naturaleza, gente, palabra, expresión y acción. Pieza estrella: sala dedicada a García Márquez. Programación cultural permanente. Espacio educativo de primer nivel.',
 'Calle 36 #46-66, Centro Histórico',
 10.9858, -74.7912,
 '+57 60 5 372 0581',
 'https://culturalcaribe.org',
 1,
 '{"monday":"closed","tuesday":"08:00-17:00","wednesday":"08:00-17:00","thursday":"08:00-17:00","friday":"08:00-18:00","saturday":"09:00-18:00","sunday":"10:00-17:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'cultura'),
 (SELECT id FROM public.profiles WHERE email = 'seed_dueno_007@xitty.local'),
 ARRAY['museo','caribe','interactivo','garcía márquez','educativo'],
 '+57 60 5 372 0581',
 NULL,
 'https://culturalcaribe.org/entradas'),

('Casa del Carnaval',
 'Sede del Carnaval de Barranquilla, declarado Patrimonio Cultural Inmaterial de la Humanidad. Exhibición permanente de disfraces, máscaras y carrozas históricas. Talleres de danza y música tradicional. Tienda con artesanías oficiales. Centro de investigación y documentación.',
 'Carrera 54 #49B-39, Centro',
 10.9959, -74.7945,
 '+57 60 5 319 7616',
 'https://carnavaldebarranquilla.org',
 1,
 '{"monday":"closed","tuesday":"09:00-17:00","wednesday":"09:00-17:00","thursday":"09:00-17:00","friday":"09:00-17:00","saturday":"09:00-15:00","sunday":"closed"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'cultura'),
 NULL,
 ARRAY['carnaval','patrimonio','danza','disfraces','tradición'],
 '+57 60 5 319 7616',
 '+57 318 778 7616',
 NULL),

('Teatro Amira de la Rosa',
 'Principal escenario cultural de la ciudad, hogar de la sinfónica del Atlántico. Programación de teatro, danza, conciertos y ópera. Edificio modernista de los años 80 frente al río Magdalena. Capacidad para 1.200 espectadores. Boletería en línea disponible.',
 'Carrera 54 #52-258, Centro',
 10.9968, -74.7949,
 '+57 60 5 379 2750',
 'https://teatroamirardelarosa.gov.co',
 2,
 '{"monday":"09:00-18:00","tuesday":"09:00-18:00","wednesday":"09:00-18:00","thursday":"09:00-21:00","friday":"09:00-22:00","saturday":"10:00-22:00","sunday":"10:00-20:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'cultura'),
 NULL,
 ARRAY['teatro','sinfónica','ópera','conciertos','espectáculos'],
 '+57 60 5 379 2750',
 NULL,
 'https://teatroamirardelarosa.gov.co/programacion'),

('Museo Romántico',
 'Casa republicana convertida en museo dedicado a la historia romántica y carnavalesca de Barranquilla. Colección de objetos de la alta sociedad local del siglo XIX y XX. Visitas guiadas con anécdotas detrás de cada objeto. Espacio íntimo y nostálgico. Gratuito para residentes locales.',
 'Carrera 54 #59-199, El Prado',
 10.9938, -74.7980,
 '+57 60 5 344 4591',
 NULL,
 1,
 '{"monday":"closed","tuesday":"09:00-12:00","wednesday":"09:00-12:00","thursday":"09:00-12:00","friday":"09:00-12:00","saturday":"closed","sunday":"closed"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'cultura'),
 NULL,
 ARRAY['museo','histórico','casa republicana','romántico','íntimo'],
 '+57 60 5 344 4591',
 NULL,
 NULL),

('Biblioteca Piloto del Caribe',
 'Centro cultural y biblioteca pública con más de 50.000 títulos. Salas de lectura, hemeroteca y archivo histórico. Programación cultural permanente: conferencias, conciertos y exposiciones. Sala infantil con actividades pedagógicas. Wifi gratuito.',
 'Calle 68 #53-45, Boston',
 10.9983, -74.8002,
 '+57 60 5 369 8090',
 'https://bibliotecapilotodelcaribe.gov.co',
 1,
 '{"monday":"08:00-20:00","tuesday":"08:00-20:00","wednesday":"08:00-20:00","thursday":"08:00-20:00","friday":"08:00-20:00","saturday":"09:00-17:00","sunday":"closed"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'cultura'),
 NULL,
 ARRAY['biblioteca','lectura','wifi','exposiciones','gratis'],
 '+57 60 5 369 8090',
 NULL,
 NULL)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- COMPRAS (5 places)
-- ============================================================================

INSERT INTO public.places (name, description, address, latitude, longitude, phone, website, price_range, schedule, category_id, owner_id, tags, cta_phone, cta_whatsapp, reservation_url)
VALUES
('Centro Comercial Buenavista',
 'Centro comercial premier de Barranquilla con más de 300 locales. Tiendas de marcas internacionales, joyería, electrónica y moda. Plaza de comidas con 40 opciones gastronómicas. Cines multisalas y zona de entretenimiento infantil. Estacionamiento amplio.',
 'Calle 98 #52-115, Villa Santos',
 11.0203, -74.8189,
 '+57 60 5 385 1500',
 'https://buenavista.com.co',
 3,
 '{"monday":"10:00-21:00","tuesday":"10:00-21:00","wednesday":"10:00-21:00","thursday":"10:00-21:00","friday":"10:00-22:00","saturday":"10:00-22:00","sunday":"10:00-21:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'compras'),
 (SELECT id FROM public.profiles WHERE email = 'seed_dueno_008@xitty.local'),
 ARRAY['centro comercial','marcas','cines','plaza de comidas','familiar'],
 '+57 60 5 385 1500',
 NULL,
 NULL),

('Mercado Público de Barranquillita',
 'Mercado tradicional más grande de la ciudad, corazón comercial popular. Productos frescos del campo y del mar a precios mayoristas. Locales de artesanías, especias y comida típica. Recorrido obligatorio para conocer la auténtica vida costeña. Mejor visitar en la mañana.',
 'Carrera 38 #4-50, Centro',
 10.9789, -74.7895,
 NULL,
 NULL,
 1,
 '{"monday":"05:00-16:00","tuesday":"05:00-16:00","wednesday":"05:00-16:00","thursday":"05:00-16:00","friday":"05:00-17:00","saturday":"05:00-17:00","sunday":"06:00-13:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'compras'),
 NULL,
 ARRAY['mercado','tradicional','frescos','popular','económico'],
 NULL,
 NULL,
 NULL),

('Centro Comercial Viva Barranquilla',
 'Moderno centro comercial estratégicamente ubicado en el norte. Mix balanceado entre marcas premium y opciones accesibles. Hipermercado Éxito, gimnasio y servicios bancarios. Áreas verdes y arquitectura abierta al aire libre. Diseño sostenible.',
 'Calle 110 #41-79, Riomar',
 11.0289, -74.7989,
 '+57 60 5 386 7800',
 'https://vivabarranquilla.com',
 3,
 '{"monday":"10:00-21:00","tuesday":"10:00-21:00","wednesday":"10:00-21:00","thursday":"10:00-21:00","friday":"10:00-22:00","saturday":"10:00-22:00","sunday":"10:00-21:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'compras'),
 NULL,
 ARRAY['centro comercial','moderno','éxito','sostenible','gym'],
 '+57 60 5 386 7800',
 NULL,
 NULL),

('Tienda Artesanal Artesanías del Caribe',
 'Tienda especializada en artesanías colombianas con énfasis en la región Caribe. Sombreros vueltiaos, mochilas wayuu y cerámica de Galapa. Tejidos a mano por comunidades indígenas y rurales. Productos certificados de comercio justo. Envío internacional disponible.',
 'Carrera 54 #76-58, El Prado',
 10.9990, -74.8035,
 '+57 60 5 369 5588',
 'https://artesaniasdelcaribe.co',
 2,
 '{"monday":"09:00-19:00","tuesday":"09:00-19:00","wednesday":"09:00-19:00","thursday":"09:00-19:00","friday":"09:00-20:00","saturday":"09:00-20:00","sunday":"11:00-17:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'compras'),
 NULL,
 ARRAY['artesanías','wayuu','sombreros','comercio justo','souvenirs'],
 '+57 60 5 369 5588',
 '+57 313 559 5588',
 NULL),

('Centro Comercial Único Outlet',
 'Outlet con descuentos permanentes en marcas nacionales e internacionales. Tres pisos de tiendas con rebajas del 30 al 70 por ciento. Patio de comidas con opciones rápidas. Diseñado para compras de gangas y temporadas. Estacionamiento gratuito.',
 'Carrera 53 #100-25, Ciudad Jardín',
 11.0250, -74.8123,
 '+57 60 5 386 4400',
 'https://unicobarranquilla.com',
 2,
 '{"monday":"10:00-20:00","tuesday":"10:00-20:00","wednesday":"10:00-20:00","thursday":"10:00-20:00","friday":"10:00-21:00","saturday":"10:00-21:00","sunday":"11:00-20:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'compras'),
 NULL,
 ARRAY['outlet','descuentos','marcas','económico','gratis parking'],
 '+57 60 5 386 4400',
 NULL,
 NULL)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- NATURALEZA (5 places)
-- ============================================================================

INSERT INTO public.places (name, description, address, latitude, longitude, phone, website, price_range, schedule, category_id, owner_id, tags, cta_phone, cta_whatsapp, reservation_url)
VALUES
('Zoológico de Barranquilla',
 'Uno de los zoológicos más importantes de Colombia, hogar de más de 700 animales de 140 especies. Reconocido por programas de conservación de fauna nativa colombiana. Hábitats diseñados a escala natural. Programa educativo escolar y visitas guiadas. Cafetería y tienda de souvenirs.',
 'Calle 77 #68-40, La Castellana',
 11.0005, -74.8245,
 '+57 60 5 360 0301',
 'https://zoobaq.org',
 2,
 '{"monday":"09:00-16:30","tuesday":"09:00-16:30","wednesday":"09:00-16:30","thursday":"09:00-16:30","friday":"09:00-17:00","saturday":"09:00-17:30","sunday":"09:00-17:30"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'naturaleza'),
 (SELECT id FROM public.profiles WHERE email = 'seed_dueno_009@xitty.local'),
 ARRAY['zoológico','familiar','animales','conservación','educativo'],
 '+57 60 5 360 0301',
 '+57 313 660 0301',
 'https://zoobaq.org/entradas'),

('Parque Sagrado Corazón',
 'Pulmón verde central de Barranquilla en pleno barrio El Prado. Senderos arbolados, lago artificial con patos y áreas para correr. Estatua del Sagrado Corazón en el centro como punto histórico. Eventos culturales al aire libre los domingos. Punto de encuentro de la comunidad.',
 'Carrera 52 con Calle 70, El Prado',
 10.9985, -74.8042,
 NULL,
 NULL,
 1,
 '{"monday":"05:00-22:00","tuesday":"05:00-22:00","wednesday":"05:00-22:00","thursday":"05:00-22:00","friday":"05:00-22:00","saturday":"05:00-23:00","sunday":"05:00-22:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'naturaleza'),
 NULL,
 ARRAY['parque','correr','lago','familiar','gratis'],
 NULL,
 NULL,
 NULL),

('Ciénaga de Mallorquín',
 'Importante humedal de 1.200 hectáreas al noroccidente de la ciudad. Hábitat de aves migratorias, garzas y caimanes. Tours en canoa con guías locales para avistamiento. Restaurantes de pescado fresco en las orillas. Recuperación ambiental en curso.',
 'Vía 40, Las Flores',
 11.0345, -74.8456,
 '+57 60 5 369 3300',
 'https://cienagamallorquin.org',
 2,
 '{"monday":"06:00-17:00","tuesday":"06:00-17:00","wednesday":"06:00-17:00","thursday":"06:00-17:00","friday":"06:00-17:00","saturday":"06:00-18:00","sunday":"06:00-18:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'naturaleza'),
 NULL,
 ARRAY['ciénaga','aves','canoa','naturaleza','avistamiento'],
 '+57 60 5 369 3300',
 '+57 318 999 3300',
 'https://cienagamallorquin.org/tours'),

('Jardín Botánico de Barranquilla',
 'Espacio dedicado a la conservación de la flora del Caribe colombiano. Más de 400 especies vegetales en diferentes ecosistemas representados. Orquidiario y mariposario abiertos al público. Talleres ambientales para niños y adultos. Cafetería con productos orgánicos.',
 'Carrera 38 #110-15, Ciudad Jardín',
 11.0245, -74.7995,
 '+57 60 5 358 7700',
 'https://jardinbotanicobaq.org',
 1,
 '{"monday":"closed","tuesday":"08:00-16:00","wednesday":"08:00-16:00","thursday":"08:00-16:00","friday":"08:00-17:00","saturday":"08:00-17:00","sunday":"08:00-17:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'naturaleza'),
 NULL,
 ARRAY['jardín botánico','flora','orquídeas','mariposario','educativo'],
 '+57 60 5 358 7700',
 NULL,
 NULL),

('Parque Ecológico Mundo Marino',
 'Centro de investigación marina con acuarios interactivos y exhibiciones de fauna del Caribe. Programa de rescate y rehabilitación de tortugas marinas. Touch pool para experiencia táctil con estrellas de mar. Visitas guiadas educativas. Tienda con productos sostenibles.',
 'Vía Puerto Colombia Km 5',
 10.9889, -74.9234,
 '+57 60 5 309 5566',
 'https://mundomarinobaq.com',
 2,
 '{"monday":"closed","tuesday":"09:00-17:00","wednesday":"09:00-17:00","thursday":"09:00-17:00","friday":"09:00-18:00","saturday":"09:00-18:00","sunday":"09:00-18:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'naturaleza'),
 NULL,
 ARRAY['acuario','tortugas','marino','educativo','familiar'],
 '+57 60 5 309 5566',
 '+57 304 999 5566',
 'https://mundomarinobaq.com/visitas')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- DEPORTES (5 places)
-- ============================================================================

INSERT INTO public.places (name, description, address, latitude, longitude, phone, website, price_range, schedule, category_id, owner_id, tags, cta_phone, cta_whatsapp, reservation_url)
VALUES
('Estadio Metropolitano Roberto Meléndez',
 'Estadio principal de fútbol de Barranquilla, sede de la Selección Colombia. Capacidad para 46.000 espectadores. Casa del Junior de Barranquilla en la liga colombiana. Tours guiados los días sin partido. Museo del Junior dentro del complejo.',
 'Carrera 46 #98-50, Ciudad Jardín',
 11.0286, -74.8245,
 '+57 60 5 359 4400',
 'https://juniorfc.co/estadio',
 2,
 '{"monday":"09:00-17:00","tuesday":"09:00-17:00","wednesday":"09:00-17:00","thursday":"09:00-17:00","friday":"09:00-17:00","saturday":"09:00-18:00","sunday":"09:00-18:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'deportes'),
 (SELECT id FROM public.profiles WHERE email = 'seed_dueno_010@xitty.local'),
 ARRAY['estadio','fútbol','junior','selección','tour'],
 '+57 60 5 359 4400',
 '+57 320 778 4400',
 'https://juniorfc.co/entradas'),

('Country Club Barranquilla',
 'Club privado tradicional con campo de golf de 18 hoyos. Canchas de tenis, pádel y squash. Piscina olímpica y gimnasio completo. Restaurantes y salones de eventos. Acceso por membresía o invitación de socios.',
 'Carrera 51B #87-99, Riomar',
 11.0085, -74.8145,
 '+57 60 5 360 1100',
 'https://countryclubbaq.com',
 4,
 '{"monday":"05:30-22:00","tuesday":"05:30-22:00","wednesday":"05:30-22:00","thursday":"05:30-22:00","friday":"05:30-23:00","saturday":"05:30-23:00","sunday":"06:00-22:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'deportes'),
 NULL,
 ARRAY['golf','tenis','piscina','exclusivo','membresía'],
 '+57 60 5 360 1100',
 NULL,
 NULL),

('Centro de Alto Rendimiento Elías Chegwin',
 'Complejo deportivo público con piscina olímpica, pista de atletismo y coliseo. Entrenamiento de deportistas de alto rendimiento del departamento del Atlántico. Abierto al público en horarios designados. Cursos de natación y atletismo. Tarifas accesibles.',
 'Calle 72 #50-15, El Recreo',
 10.9980, -74.8085,
 '+57 60 5 358 4400',
 NULL,
 1,
 '{"monday":"06:00-21:00","tuesday":"06:00-21:00","wednesday":"06:00-21:00","thursday":"06:00-21:00","friday":"06:00-21:00","saturday":"07:00-19:00","sunday":"08:00-17:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'deportes'),
 NULL,
 ARRAY['piscina','atletismo','público','económico','natación'],
 '+57 60 5 358 4400',
 NULL,
 NULL),

('Club Náutico de Barranquilla',
 'Club especializado en deportes acuáticos sobre el río Magdalena. Vela, kayak, jet ski y wakeboard. Restaurante con vista al río. Clases para principiantes y avanzados. Marina con capacidad para 80 embarcaciones.',
 'Vía 40 #79-200, Las Flores',
 11.0289, -74.7723,
 '+57 60 5 354 6600',
 'https://clubnauticobaq.com',
 4,
 '{"monday":"closed","tuesday":"07:00-19:00","wednesday":"07:00-19:00","thursday":"07:00-19:00","friday":"07:00-21:00","saturday":"06:00-21:00","sunday":"06:00-20:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'deportes'),
 NULL,
 ARRAY['náutico','vela','kayak','río','marina'],
 '+57 60 5 354 6600',
 '+57 318 778 6600',
 'https://clubnauticobaq.com/clases'),

('Coliseo Cubierto Humberto Perea',
 'Coliseo multiusos para eventos deportivos y conciertos. Capacidad para 7.000 personas en eventos deportivos. Sede de torneos de baloncesto, voleibol y boxeo. Eventos musicales y culturales periódicamente. Ubicación céntrica de fácil acceso.',
 'Calle 72 #46-15, Boston',
 10.9985, -74.7990,
 '+57 60 5 369 7700',
 NULL,
 2,
 '{"monday":"08:00-20:00","tuesday":"08:00-20:00","wednesday":"08:00-20:00","thursday":"08:00-20:00","friday":"08:00-23:00","saturday":"09:00-23:00","sunday":"09:00-22:00"}'::jsonb,
 (SELECT id FROM public.categories WHERE slug = 'deportes'),
 NULL,
 ARRAY['coliseo','baloncesto','conciertos','eventos','céntrico'],
 '+57 60 5 369 7700',
 NULL,
 NULL)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PLACE PHOTOS
-- ============================================================================

-- La Cueva Restaurante
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'La Cueva Restaurante' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80', 'Salón principal de La Cueva con ambiente literario', true, 0),
((SELECT id FROM public.places WHERE name = 'La Cueva Restaurante' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80', 'Plato de pescado al estilo costeño', false, 1),
((SELECT id FROM public.places WHERE name = 'La Cueva Restaurante' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1200&q=80', 'Bar tradicional de La Cueva', false, 2),
((SELECT id FROM public.places WHERE name = 'La Cueva Restaurante' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1200&q=80', 'Mesa servida con mariscos frescos', false, 3),
((SELECT id FROM public.places WHERE name = 'La Cueva Restaurante' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=1200&q=80', 'Decoración bohemia del restaurante', false, 4),
((SELECT id FROM public.places WHERE name = 'La Cueva Restaurante' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=1200&q=80', 'Cazuela de mariscos servida', false, 5);

-- Bollo Gourmet
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Bollo Gourmet' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80', 'Bollos rellenos gourmet de la casa', true, 0),
((SELECT id FROM public.places WHERE name = 'Bollo Gourmet' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80', 'Interior moderno del restaurante', false, 1),
((SELECT id FROM public.places WHERE name = 'Bollo Gourmet' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1200&q=80', 'Patio interior con plantas', false, 2),
((SELECT id FROM public.places WHERE name = 'Bollo Gourmet' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1200&q=80', 'Mesa con varios platos', false, 3),
((SELECT id FROM public.places WHERE name = 'Bollo Gourmet' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=1200&q=80', 'Plato creativo de cocina caribeña', false, 4);

-- Comedor 7 Bocas
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Comedor 7 Bocas' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=1200&q=80', 'Sancocho de pescado humeante', true, 0),
((SELECT id FROM public.places WHERE name = 'Comedor 7 Bocas' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80', 'Pescado frito con patacones', false, 1),
((SELECT id FROM public.places WHERE name = 'Comedor 7 Bocas' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80', 'Vista al río Magdalena desde el comedor', false, 2),
((SELECT id FROM public.places WHERE name = 'Comedor 7 Bocas' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1200&q=80', 'Arroz de mariscos tradicional', false, 3),
((SELECT id FROM public.places WHERE name = 'Comedor 7 Bocas' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1200&q=80', 'Mesa familiar con vista al agua', false, 4);

-- Cocina 33
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Cocina 33' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1200&q=80', 'Plato gourmet de autor en Cocina 33', true, 0),
((SELECT id FROM public.places WHERE name = 'Cocina 33' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80', 'Comedor elegante en casa republicana', false, 1),
((SELECT id FROM public.places WHERE name = 'Cocina 33' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80', 'Detalle de plato del menú degustación', false, 2),
((SELECT id FROM public.places WHERE name = 'Cocina 33' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1200&q=80', 'Bodega de vinos selectos', false, 3),
((SELECT id FROM public.places WHERE name = 'Cocina 33' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=1200&q=80', 'Postre artístico del chef', false, 4),
((SELECT id FROM public.places WHERE name = 'Cocina 33' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=1200&q=80', 'Mesa preparada para reservación romántica', false, 5),
((SELECT id FROM public.places WHERE name = 'Cocina 33' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1530541930197-ff16ac917b0e?w=1200&q=80', 'Entrada con jardín de la casa', false, 6);

-- Restaurante Devis
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Restaurante Devis' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1200&q=80', 'Cazuela de mariscos especialidad de Devis', true, 0),
((SELECT id FROM public.places WHERE name = 'Restaurante Devis' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80', 'Salón familiar del restaurante', false, 1),
((SELECT id FROM public.places WHERE name = 'Restaurante Devis' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80', 'Arroz con coco tradicional', false, 2),
((SELECT id FROM public.places WHERE name = 'Restaurante Devis' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=1200&q=80', 'Pescado entero al horno', false, 3),
((SELECT id FROM public.places WHERE name = 'Restaurante Devis' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1200&q=80', 'Mesa servida estilo costeño', false, 4),
((SELECT id FROM public.places WHERE name = 'Restaurante Devis' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=1200&q=80', 'Detalle del histórico salón', false, 5);

-- Bocas de Ceniza
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Bocas de Ceniza' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80', 'Vista del encuentro del río con el mar', true, 0),
((SELECT id FROM public.places WHERE name = 'Bocas de Ceniza' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200&q=80', 'Tren turístico hacia Bocas de Ceniza', false, 1),
((SELECT id FROM public.places WHERE name = 'Bocas de Ceniza' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?w=1200&q=80', 'Tajamar occidental al amanecer', false, 2),
((SELECT id FROM public.places WHERE name = 'Bocas de Ceniza' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1473625247510-8ceb1760943f?w=1200&q=80', 'Pelícanos sobre el agua', false, 3),
((SELECT id FROM public.places WHERE name = 'Bocas de Ceniza' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1530541930197-ff16ac917b0e?w=1200&q=80', 'Paisaje del río Magdalena', false, 4),
((SELECT id FROM public.places WHERE name = 'Bocas de Ceniza' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=1200&q=80', 'Atardecer en el tajamar', false, 5),
((SELECT id FROM public.places WHERE name = 'Bocas de Ceniza' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=1200&q=80', 'Vista panorámica del cruce de aguas', false, 6);

-- Castillo de Salgar
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Castillo de Salgar' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200&q=80', 'Castillo colonial de Salgar al atardecer', true, 0),
((SELECT id FROM public.places WHERE name = 'Castillo de Salgar' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80', 'Vista al mar desde el castillo', false, 1),
((SELECT id FROM public.places WHERE name = 'Castillo de Salgar' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1473625247510-8ceb1760943f?w=1200&q=80', 'Murallas históricas de la fortaleza', false, 2),
((SELECT id FROM public.places WHERE name = 'Castillo de Salgar' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1530541930197-ff16ac917b0e?w=1200&q=80', 'Patio interior del castillo', false, 3),
((SELECT id FROM public.places WHERE name = 'Castillo de Salgar' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?w=1200&q=80', 'Cañón histórico apuntando al mar', false, 4);

-- Ventana al Mundo
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Ventana al Mundo' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=1200&q=80', 'Monumento Ventana al Mundo iluminado', true, 0),
((SELECT id FROM public.places WHERE name = 'Ventana al Mundo' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=1200&q=80', 'Vista nocturna del monumento', false, 1),
((SELECT id FROM public.places WHERE name = 'Ventana al Mundo' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80', 'Plaza alrededor del monumento', false, 2),
((SELECT id FROM public.places WHERE name = 'Ventana al Mundo' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1473625247510-8ceb1760943f?w=1200&q=80', 'Estructura metálica al atardecer', false, 3),
((SELECT id FROM public.places WHERE name = 'Ventana al Mundo' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200&q=80', 'Áreas verdes del entorno', false, 4),
((SELECT id FROM public.places WHERE name = 'Ventana al Mundo' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1530541930197-ff16ac917b0e?w=1200&q=80', 'Espectáculo de luces nocturno', false, 5);

-- Plaza de la Paz
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Plaza de la Paz' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?w=1200&q=80', 'Plaza de la Paz con la catedral al fondo', true, 0),
((SELECT id FROM public.places WHERE name = 'Plaza de la Paz' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1473625247510-8ceb1760943f?w=1200&q=80', 'Escultura La Caridad de Negret', false, 1),
((SELECT id FROM public.places WHERE name = 'Plaza de la Paz' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=1200&q=80', 'Vista aérea de la plaza', false, 2),
((SELECT id FROM public.places WHERE name = 'Plaza de la Paz' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200&q=80', 'Catedral Metropolitana iluminada', false, 3),
((SELECT id FROM public.places WHERE name = 'Plaza de la Paz' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80', 'Plaza llena de gente en evento', false, 4);

-- Paseo Bolívar
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Paseo Bolívar' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1530541930197-ff16ac917b0e?w=1200&q=80', 'Paseo Bolívar peatonal con edificios coloniales', true, 0),
((SELECT id FROM public.places WHERE name = 'Paseo Bolívar' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=1200&q=80', 'Murales urbanos contemporáneos', false, 1),
((SELECT id FROM public.places WHERE name = 'Paseo Bolívar' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?w=1200&q=80', 'Vendedores tradicionales del centro', false, 2),
((SELECT id FROM public.places WHERE name = 'Paseo Bolívar' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1473625247510-8ceb1760943f?w=1200&q=80', 'Edificios republicanos restaurados', false, 3),
((SELECT id FROM public.places WHERE name = 'Paseo Bolívar' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=1200&q=80', 'Vida diurna en el centro histórico', false, 4),
((SELECT id FROM public.places WHERE name = 'Paseo Bolívar' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80', 'Detalles arquitectónicos coloniales', false, 5);

-- Frogg Leggs Pub
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Frogg Leggs Pub' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1200&q=80', 'Interior del pub estilo inglés', true, 0),
((SELECT id FROM public.places WHERE name = 'Frogg Leggs Pub' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1538488881038-e252a119ace7?w=1200&q=80', 'Barra con cervezas de barril', false, 1),
((SELECT id FROM public.places WHERE name = 'Frogg Leggs Pub' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=1200&q=80', 'Banda en vivo en el pub', false, 2),
((SELECT id FROM public.places WHERE name = 'Frogg Leggs Pub' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1546171753-97d7676e4602?w=1200&q=80', 'Alitas y cerveza artesanal', false, 3),
((SELECT id FROM public.places WHERE name = 'Frogg Leggs Pub' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1525268323446-0505b6fe7778?w=1200&q=80', 'Decoración temática rockera', false, 4),
((SELECT id FROM public.places WHERE name = 'Frogg Leggs Pub' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=1200&q=80', 'Ambiente nocturno animado', false, 5);

-- La Troja
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'La Troja' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=1200&q=80', 'La Troja esquina de salsa en Barranquilla', true, 0),
((SELECT id FROM public.places WHERE name = 'La Troja' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1200&q=80', 'Bailadores en la calle', false, 1),
((SELECT id FROM public.places WHERE name = 'La Troja' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1538488881038-e252a119ace7?w=1200&q=80', 'Vinilos de salsa clásica', false, 2),
((SELECT id FROM public.places WHERE name = 'La Troja' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1546171753-97d7676e4602?w=1200&q=80', 'Cerveza y rumba en la esquina', false, 3),
((SELECT id FROM public.places WHERE name = 'La Troja' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1525268323446-0505b6fe7778?w=1200&q=80', 'Ambiente popular de barrio', false, 4);

-- Henry´s Café
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Henry´s Café' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=1200&q=80', 'Terraza de Henry´s Café', true, 0),
((SELECT id FROM public.places WHERE name = 'Henry´s Café' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1200&q=80', 'Cocteles de autor preparados', false, 1),
((SELECT id FROM public.places WHERE name = 'Henry´s Café' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1538488881038-e252a119ace7?w=1200&q=80', 'Bar con bebidas premium', false, 2),
((SELECT id FROM public.places WHERE name = 'Henry´s Café' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=1200&q=80', 'DJ en cabina los sábados', false, 3),
((SELECT id FROM public.places WHERE name = 'Henry´s Café' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1546171753-97d7676e4602?w=1200&q=80', 'Mesa con cocteles variados', false, 4),
((SELECT id FROM public.places WHERE name = 'Henry´s Café' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1525268323446-0505b6fe7778?w=1200&q=80', 'Ambiente joven y dinámico', false, 5);

-- Maddox Discoteca
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Maddox Discoteca' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1525268323446-0505b6fe7778?w=1200&q=80', 'Pista de baile de Maddox con luces', true, 0),
((SELECT id FROM public.places WHERE name = 'Maddox Discoteca' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=1200&q=80', 'DJ internacional en cabina', false, 1),
((SELECT id FROM public.places WHERE name = 'Maddox Discoteca' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1200&q=80', 'Mesa VIP con bebidas premium', false, 2),
((SELECT id FROM public.places WHERE name = 'Maddox Discoteca' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=1200&q=80', 'Multitud disfrutando la fiesta', false, 3),
((SELECT id FROM public.places WHERE name = 'Maddox Discoteca' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1538488881038-e252a119ace7?w=1200&q=80', 'Sistema de luces y sonido', false, 4),
((SELECT id FROM public.places WHERE name = 'Maddox Discoteca' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1546171753-97d7676e4602?w=1200&q=80', 'Bar principal de la discoteca', false, 5),
((SELECT id FROM public.places WHERE name = 'Maddox Discoteca' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1493676304819-0d7a8d026dcf?w=1200&q=80', 'Zona de baile con efectos visuales', false, 6);

-- La Cueva del Champeta
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'La Cueva del Champeta' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1546171753-97d7676e4602?w=1200&q=80', 'Picó tradicional reproduciendo champeta', true, 0),
((SELECT id FROM public.places WHERE name = 'La Cueva del Champeta' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=1200&q=80', 'Bailadores de champeta en acción', false, 1),
((SELECT id FROM public.places WHERE name = 'La Cueva del Champeta' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1525268323446-0505b6fe7778?w=1200&q=80', 'Afiches de leyendas del género', false, 2),
((SELECT id FROM public.places WHERE name = 'La Cueva del Champeta' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1200&q=80', 'Ambiente popular y auténtico', false, 3),
((SELECT id FROM public.places WHERE name = 'La Cueva del Champeta' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1538488881038-e252a119ace7?w=1200&q=80', 'Sound system clásico', false, 4);

-- Tour Carnaval de Barranquilla
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Tour Carnaval de Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&q=80', 'Carrozas del Carnaval de Barranquilla', true, 0),
((SELECT id FROM public.places WHERE name = 'Tour Carnaval de Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=1200&q=80', 'Bailadores de cumbia tradicional', false, 1),
((SELECT id FROM public.places WHERE name = 'Tour Carnaval de Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1551269901-5c5e14c25df7?w=1200&q=80', 'Máscaras de marimonda características', false, 2),
((SELECT id FROM public.places WHERE name = 'Tour Carnaval de Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1521336575822-6da63fb45455?w=1200&q=80', 'Hacedor de disfraces en su taller', false, 3),
((SELECT id FROM public.places WHERE name = 'Tour Carnaval de Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1530541930197-ff16ac917b0e?w=1200&q=80', 'Casa del Carnaval entrada principal', false, 4),
((SELECT id FROM public.places WHERE name = 'Tour Carnaval de Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=1200&q=80', 'Grupo de mapalé bailando', false, 5);

-- Paseo en Yate por el Río Magdalena
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Paseo en Yate por el Río Magdalena' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200&q=80', 'Yate navegando el río Magdalena', true, 0),
((SELECT id FROM public.places WHERE name = 'Paseo en Yate por el Río Magdalena' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80', 'Vista del río al atardecer', false, 1),
((SELECT id FROM public.places WHERE name = 'Paseo en Yate por el Río Magdalena' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1473625247510-8ceb1760943f?w=1200&q=80', 'Manglares del río Magdalena', false, 2),
((SELECT id FROM public.places WHERE name = 'Paseo en Yate por el Río Magdalena' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?w=1200&q=80', 'Aves migratorias en vuelo', false, 3),
((SELECT id FROM public.places WHERE name = 'Paseo en Yate por el Río Magdalena' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1530541930197-ff16ac917b0e?w=1200&q=80', 'Muelle de Las Flores embarcadero', false, 4),
((SELECT id FROM public.places WHERE name = 'Paseo en Yate por el Río Magdalena' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=1200&q=80', 'Pasajeros disfrutando el paseo', false, 5);

-- Clase de Cocina Costeña Auténtica
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Clase de Cocina Costeña Auténtica' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=1200&q=80', 'Sancocho trifásico recién preparado', true, 0),
((SELECT id FROM public.places WHERE name = 'Clase de Cocina Costeña Auténtica' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80', 'Chef enseñando técnicas locales', false, 1),
((SELECT id FROM public.places WHERE name = 'Clase de Cocina Costeña Auténtica' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80', 'Ingredientes del mercado de Barranquillita', false, 2),
((SELECT id FROM public.places WHERE name = 'Clase de Cocina Costeña Auténtica' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1200&q=80', 'Grupo cocinando juntos', false, 3),
((SELECT id FROM public.places WHERE name = 'Clase de Cocina Costeña Auténtica' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1200&q=80', 'Patio con cocina estilo rancho', false, 4);

-- Clases de Cumbia y Mapalé
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Clases de Cumbia y Mapalé' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=1200&q=80', 'Clase de cumbia con vestuario tradicional', true, 0),
((SELECT id FROM public.places WHERE name = 'Clases de Cumbia y Mapalé' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&q=80', 'Bailadores practicando mapalé', false, 1),
((SELECT id FROM public.places WHERE name = 'Clases de Cumbia y Mapalé' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1551269901-5c5e14c25df7?w=1200&q=80', 'Tambor alegre y gaita en vivo', false, 2),
((SELECT id FROM public.places WHERE name = 'Clases de Cumbia y Mapalé' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1521336575822-6da63fb45455?w=1200&q=80', 'Vestuarios tradicionales de cumbia', false, 3),
((SELECT id FROM public.places WHERE name = 'Clases de Cumbia y Mapalé' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=1200&q=80', 'Profesores demostrando pasos', false, 4),
((SELECT id FROM public.places WHERE name = 'Clases de Cumbia y Mapalé' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1530541930197-ff16ac917b0e?w=1200&q=80', 'Salón con espejos de academia', false, 5);

-- City Tour en Chiva Rumbera
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'City Tour en Chiva Rumbera' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1551269901-5c5e14c25df7?w=1200&q=80', 'Chiva rumbera decorada de colores', true, 0),
((SELECT id FROM public.places WHERE name = 'City Tour en Chiva Rumbera' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&q=80', 'Grupo bailando dentro de la chiva', false, 1),
((SELECT id FROM public.places WHERE name = 'City Tour en Chiva Rumbera' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=1200&q=80', 'Recorrido nocturno por la ciudad', false, 2),
((SELECT id FROM public.places WHERE name = 'City Tour en Chiva Rumbera' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=1200&q=80', 'Música tropical en vivo a bordo', false, 3),
((SELECT id FROM public.places WHERE name = 'City Tour en Chiva Rumbera' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1521336575822-6da63fb45455?w=1200&q=80', 'Parada en Ventana al Mundo', false, 4);

-- Hotel Estelar En Alto Prado
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Hotel Estelar En Alto Prado' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80', 'Fachada del Hotel Estelar Alto Prado', true, 0),
((SELECT id FROM public.places WHERE name = 'Hotel Estelar En Alto Prado' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=80', 'Habitación suite premium', false, 1),
((SELECT id FROM public.places WHERE name = 'Hotel Estelar En Alto Prado' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200&q=80', 'Piscina infinity en la azotea', false, 2),
((SELECT id FROM public.places WHERE name = 'Hotel Estelar En Alto Prado' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80', 'Lobby moderno del hotel', false, 3),
((SELECT id FROM public.places WHERE name = 'Hotel Estelar En Alto Prado' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&q=80', 'Spa con tratamientos premium', false, 4),
((SELECT id FROM public.places WHERE name = 'Hotel Estelar En Alto Prado' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80', 'Restaurante de cocina internacional', false, 5),
((SELECT id FROM public.places WHERE name = 'Hotel Estelar En Alto Prado' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80', 'Sala de conferencias equipada', false, 6);

-- Hotel El Prado
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Hotel El Prado' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=80', 'Fachada histórica del Hotel El Prado', true, 0),
((SELECT id FROM public.places WHERE name = 'Hotel El Prado' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80', 'Piscina rodeada de palmeras', false, 1),
((SELECT id FROM public.places WHERE name = 'Hotel El Prado' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200&q=80', 'Habitación con encanto colonial', false, 2),
((SELECT id FROM public.places WHERE name = 'Hotel El Prado' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80', 'Jardines tropicales del hotel', false, 3),
((SELECT id FROM public.places WHERE name = 'Hotel El Prado' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&q=80', 'Restaurante gourmet del hotel', false, 4),
((SELECT id FROM public.places WHERE name = 'Hotel El Prado' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80', 'Detalle arquitectónico colonial', false, 5);

-- Hotel Country International
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Hotel Country International' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80', 'Fachada del Hotel Country International', true, 0),
((SELECT id FROM public.places WHERE name = 'Hotel Country International' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80', 'Habitación ejecutiva funcional', false, 1),
((SELECT id FROM public.places WHERE name = 'Hotel Country International' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80', 'Lobby de negocios', false, 2),
((SELECT id FROM public.places WHERE name = 'Hotel Country International' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=80', 'Restaurante buffet del hotel', false, 3),
((SELECT id FROM public.places WHERE name = 'Hotel Country International' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200&q=80', 'Gym 24 horas equipado', false, 4),
((SELECT id FROM public.places WHERE name = 'Hotel Country International' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&q=80', 'Salón de reuniones corporativo', false, 5);

-- Hotel Boutique Casa Riomar
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Hotel Boutique Casa Riomar' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200&q=80', 'Casa boutique con estilo contemporáneo', true, 0),
((SELECT id FROM public.places WHERE name = 'Hotel Boutique Casa Riomar' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=80', 'Habitación íntima con diseño caribeño', false, 1),
((SELECT id FROM public.places WHERE name = 'Hotel Boutique Casa Riomar' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80', 'Patio interior con piscina', false, 2),
((SELECT id FROM public.places WHERE name = 'Hotel Boutique Casa Riomar' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80', 'Bar del patio', false, 3),
((SELECT id FROM public.places WHERE name = 'Hotel Boutique Casa Riomar' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&q=80', 'Desayuno gourmet servido', false, 4),
((SELECT id FROM public.places WHERE name = 'Hotel Boutique Casa Riomar' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80', 'Detalle del diseño contemporáneo', false, 5);

-- Hostal La Casa del Carnaval
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Hostal La Casa del Carnaval' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80', 'Hostal con decoración carnavalesca', true, 0),
((SELECT id FROM public.places WHERE name = 'Hostal La Casa del Carnaval' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200&q=80', 'Terraza con hamacas', false, 1),
((SELECT id FROM public.places WHERE name = 'Hostal La Casa del Carnaval' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80', 'Habitación privada económica', false, 2),
((SELECT id FROM public.places WHERE name = 'Hostal La Casa del Carnaval' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=80', 'Cocina común del hostal', false, 3),
((SELECT id FROM public.places WHERE name = 'Hostal La Casa del Carnaval' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80', 'Dormitorio compartido', false, 4);

-- Playa Pradomar
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Playa Pradomar' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80', 'Playa Pradomar con arena dorada', true, 0),
((SELECT id FROM public.places WHERE name = 'Playa Pradomar' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1473625247510-8ceb1760943f?w=1200&q=80', 'Atardecer en la playa', false, 1),
((SELECT id FROM public.places WHERE name = 'Playa Pradomar' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200&q=80', 'Carpas y sillas en la arena', false, 2),
((SELECT id FROM public.places WHERE name = 'Playa Pradomar' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?w=1200&q=80', 'Restaurantes de pescado fresco', false, 3),
((SELECT id FROM public.places WHERE name = 'Playa Pradomar' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=1200&q=80', 'Familia disfrutando del mar', false, 4),
((SELECT id FROM public.places WHERE name = 'Playa Pradomar' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=1200&q=80', 'Vista panorámica del Caribe', false, 5);

-- Playa Sabanilla
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Playa Sabanilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1473625247510-8ceb1760943f?w=1200&q=80', 'Playa Sabanilla tradicional', true, 0),
((SELECT id FROM public.places WHERE name = 'Playa Sabanilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80', 'Pescadores con sus redes', false, 1),
((SELECT id FROM public.places WHERE name = 'Playa Sabanilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200&q=80', 'Kioscos rústicos de mariscos', false, 2),
((SELECT id FROM public.places WHERE name = 'Playa Sabanilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?w=1200&q=80', 'Lanchas tradicionales en la orilla', false, 3),
((SELECT id FROM public.places WHERE name = 'Playa Sabanilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=1200&q=80', 'Atardecer tranquilo en Sabanilla', false, 4);

-- Playa Salgar
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Playa Salgar' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=1200&q=80', 'Playa Salgar al pie del castillo', true, 0),
((SELECT id FROM public.places WHERE name = 'Playa Salgar' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80', 'Aguas calmadas ideales para nadar', false, 1),
((SELECT id FROM public.places WHERE name = 'Playa Salgar' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1473625247510-8ceb1760943f?w=1200&q=80', 'Rocas formando piscinas naturales', false, 2),
((SELECT id FROM public.places WHERE name = 'Playa Salgar' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?w=1200&q=80', 'Vista del castillo desde la playa', false, 3),
((SELECT id FROM public.places WHERE name = 'Playa Salgar' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=1200&q=80', 'Ambiente íntimo y tranquilo', false, 4);

-- Playa Puerto Velero
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Playa Puerto Velero' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=1200&q=80', 'Aguas cristalinas de Puerto Velero', true, 0),
((SELECT id FROM public.places WHERE name = 'Playa Puerto Velero' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80', 'Kitesurf en la playa', false, 1),
((SELECT id FROM public.places WHERE name = 'Playa Puerto Velero' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1473625247510-8ceb1760943f?w=1200&q=80', 'Arena blanca finísima', false, 2),
((SELECT id FROM public.places WHERE name = 'Playa Puerto Velero' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=1200&q=80', 'Restaurantes y bares de playa', false, 3),
((SELECT id FROM public.places WHERE name = 'Playa Puerto Velero' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200&q=80', 'Paddle board en aguas turquesa', false, 4),
((SELECT id FROM public.places WHERE name = 'Playa Puerto Velero' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?w=1200&q=80', 'Vista aérea de Puerto Velero', false, 5),
((SELECT id FROM public.places WHERE name = 'Playa Puerto Velero' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1530541930197-ff16ac917b0e?w=1200&q=80', 'Cabañas frente al mar', false, 6);

-- Playa Caño Dulce
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Playa Caño Dulce' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1530541930197-ff16ac917b0e?w=1200&q=80', 'Playa virgen de Caño Dulce', true, 0),
((SELECT id FROM public.places WHERE name = 'Playa Caño Dulce' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80', 'Manglares y formaciones rocosas', false, 1),
((SELECT id FROM public.places WHERE name = 'Playa Caño Dulce' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1473625247510-8ceb1760943f?w=1200&q=80', 'Paisaje natural intocado', false, 2),
((SELECT id FROM public.places WHERE name = 'Playa Caño Dulce' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=1200&q=80', 'Tortuga marina avistada', false, 3),
((SELECT id FROM public.places WHERE name = 'Playa Caño Dulce' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?w=1200&q=80', 'Costa virgen sin servicios', false, 4);

-- Museo del Caribe
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Museo del Caribe' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1565060169187-5284ec19a630?w=1200&q=80', 'Museo del Caribe fachada moderna', true, 0),
((SELECT id FROM public.places WHERE name = 'Museo del Caribe' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=1200&q=80', 'Sala interactiva del museo', false, 1),
((SELECT id FROM public.places WHERE name = 'Museo del Caribe' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1572947650440-e8a97ef053b2?w=1200&q=80', 'Exposición dedicada a García Márquez', false, 2),
((SELECT id FROM public.places WHERE name = 'Museo del Caribe' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1564399263809-d2e7b04b5b14?w=1200&q=80', 'Sala de naturaleza caribeña', false, 3),
((SELECT id FROM public.places WHERE name = 'Museo del Caribe' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=1200&q=80', 'Programación cultural en el auditorio', false, 4),
((SELECT id FROM public.places WHERE name = 'Museo del Caribe' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1503632235391-bca0464b6213?w=1200&q=80', 'Espacios educativos para escolares', false, 5);

-- Casa del Carnaval
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Casa del Carnaval' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&q=80', 'Casa del Carnaval con exhibición', true, 0),
((SELECT id FROM public.places WHERE name = 'Casa del Carnaval' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1551269901-5c5e14c25df7?w=1200&q=80', 'Disfraces tradicionales exhibidos', false, 1),
((SELECT id FROM public.places WHERE name = 'Casa del Carnaval' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1521336575822-6da63fb45455?w=1200&q=80', 'Máscaras de marimonda', false, 2),
((SELECT id FROM public.places WHERE name = 'Casa del Carnaval' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=1200&q=80', 'Taller de música tradicional', false, 3),
((SELECT id FROM public.places WHERE name = 'Casa del Carnaval' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1565060169187-5284ec19a630?w=1200&q=80', 'Centro de documentación cultural', false, 4),
((SELECT id FROM public.places WHERE name = 'Casa del Carnaval' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=1200&q=80', 'Tienda de artesanías oficial', false, 5);

-- Teatro Amira de la Rosa
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Teatro Amira de la Rosa' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1503632235391-bca0464b6213?w=1200&q=80', 'Teatro Amira de la Rosa fachada', true, 0),
((SELECT id FROM public.places WHERE name = 'Teatro Amira de la Rosa' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=1200&q=80', 'Sala principal con butacas', false, 1),
((SELECT id FROM public.places WHERE name = 'Teatro Amira de la Rosa' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1572947650440-e8a97ef053b2?w=1200&q=80', 'Sinfónica del Atlántico en concierto', false, 2),
((SELECT id FROM public.places WHERE name = 'Teatro Amira de la Rosa' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1564399263809-d2e7b04b5b14?w=1200&q=80', 'Vista al río Magdalena desde el teatro', false, 3),
((SELECT id FROM public.places WHERE name = 'Teatro Amira de la Rosa' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=1200&q=80', 'Foyer modernista del teatro', false, 4);

-- Museo Romántico
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Museo Romántico' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=1200&q=80', 'Museo Romántico casa republicana', true, 0),
((SELECT id FROM public.places WHERE name = 'Museo Romántico' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1565060169187-5284ec19a630?w=1200&q=80', 'Colección de objetos históricos', false, 1),
((SELECT id FROM public.places WHERE name = 'Museo Romántico' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1572947650440-e8a97ef053b2?w=1200&q=80', 'Salón con muebles del siglo XIX', false, 2),
((SELECT id FROM public.places WHERE name = 'Museo Romántico' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1564399263809-d2e7b04b5b14?w=1200&q=80', 'Objetos de la alta sociedad local', false, 3),
((SELECT id FROM public.places WHERE name = 'Museo Romántico' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1503632235391-bca0464b6213?w=1200&q=80', 'Visita guiada por el museo', false, 4);

-- Biblioteca Piloto del Caribe
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Biblioteca Piloto del Caribe' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=1200&q=80', 'Sala de lectura de la biblioteca', true, 0),
((SELECT id FROM public.places WHERE name = 'Biblioteca Piloto del Caribe' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=1200&q=80', 'Hemeroteca con periódicos antiguos', false, 1),
((SELECT id FROM public.places WHERE name = 'Biblioteca Piloto del Caribe' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1565060169187-5284ec19a630?w=1200&q=80', 'Sala infantil con actividades', false, 2),
((SELECT id FROM public.places WHERE name = 'Biblioteca Piloto del Caribe' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1572947650440-e8a97ef053b2?w=1200&q=80', 'Estanterías con más de 50.000 títulos', false, 3),
((SELECT id FROM public.places WHERE name = 'Biblioteca Piloto del Caribe' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1564399263809-d2e7b04b5b14?w=1200&q=80', 'Exposición temporal en la biblioteca', false, 4),
((SELECT id FROM public.places WHERE name = 'Biblioteca Piloto del Caribe' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1503632235391-bca0464b6213?w=1200&q=80', 'Espacio de estudio con wifi gratuito', false, 5);

-- Centro Comercial Buenavista
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Centro Comercial Buenavista' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1481437156560-3205f6a55735?w=1200&q=80', 'Centro Comercial Buenavista entrada', true, 0),
((SELECT id FROM public.places WHERE name = 'Centro Comercial Buenavista' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=1200&q=80', 'Pasillo interior con tiendas', false, 1),
((SELECT id FROM public.places WHERE name = 'Centro Comercial Buenavista' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=1200&q=80', 'Plaza de comidas amplia', false, 2),
((SELECT id FROM public.places WHERE name = 'Centro Comercial Buenavista' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1591085686350-798c0f9faa7f?w=1200&q=80', 'Zona de entretenimiento infantil', false, 3),
((SELECT id FROM public.places WHERE name = 'Centro Comercial Buenavista' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=1200&q=80', 'Tiendas de marcas internacionales', false, 4),
((SELECT id FROM public.places WHERE name = 'Centro Comercial Buenavista' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&q=80', 'Cines multisalas del centro comercial', false, 5);

-- Mercado Público de Barranquillita
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Mercado Público de Barranquillita' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=1200&q=80', 'Mercado Público de Barranquillita', true, 0),
((SELECT id FROM public.places WHERE name = 'Mercado Público de Barranquillita' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1591085686350-798c0f9faa7f?w=1200&q=80', 'Puesto de frutas tropicales', false, 1),
((SELECT id FROM public.places WHERE name = 'Mercado Público de Barranquillita' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=1200&q=80', 'Pescaderías con productos frescos', false, 2),
((SELECT id FROM public.places WHERE name = 'Mercado Público de Barranquillita' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1481437156560-3205f6a55735?w=1200&q=80', 'Especias y condimentos del Caribe', false, 3),
((SELECT id FROM public.places WHERE name = 'Mercado Público de Barranquillita' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=1200&q=80', 'Vendedores tradicionales del mercado', false, 4);

-- Centro Comercial Viva Barranquilla
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Centro Comercial Viva Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=1200&q=80', 'Centro Comercial Viva Barranquilla', true, 0),
((SELECT id FROM public.places WHERE name = 'Centro Comercial Viva Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1481437156560-3205f6a55735?w=1200&q=80', 'Diseño moderno con áreas verdes', false, 1),
((SELECT id FROM public.places WHERE name = 'Centro Comercial Viva Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=1200&q=80', 'Pasillos con marcas premium', false, 2),
((SELECT id FROM public.places WHERE name = 'Centro Comercial Viva Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1591085686350-798c0f9faa7f?w=1200&q=80', 'Hipermercado Éxito interior', false, 3),
((SELECT id FROM public.places WHERE name = 'Centro Comercial Viva Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=1200&q=80', 'Plaza al aire libre del centro', false, 4),
((SELECT id FROM public.places WHERE name = 'Centro Comercial Viva Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&q=80', 'Tiendas de la zona principal', false, 5);

-- Tienda Artesanal Artesanías del Caribe
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Tienda Artesanal Artesanías del Caribe' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1591085686350-798c0f9faa7f?w=1200&q=80', 'Mochilas wayuu en exhibición', true, 0),
((SELECT id FROM public.places WHERE name = 'Tienda Artesanal Artesanías del Caribe' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=1200&q=80', 'Sombreros vueltiaos tradicionales', false, 1),
((SELECT id FROM public.places WHERE name = 'Tienda Artesanal Artesanías del Caribe' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=1200&q=80', 'Cerámica de Galapa artesanal', false, 2),
((SELECT id FROM public.places WHERE name = 'Tienda Artesanal Artesanías del Caribe' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=1200&q=80', 'Interior de la tienda artesanal', false, 3),
((SELECT id FROM public.places WHERE name = 'Tienda Artesanal Artesanías del Caribe' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1481437156560-3205f6a55735?w=1200&q=80', 'Tejidos elaborados a mano', false, 4),
((SELECT id FROM public.places WHERE name = 'Tienda Artesanal Artesanías del Caribe' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&q=80', 'Souvenirs colombianos diversos', false, 5);

-- Centro Comercial Único Outlet
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Centro Comercial Único Outlet' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=1200&q=80', 'Centro Comercial Único Outlet entrada', true, 0),
((SELECT id FROM public.places WHERE name = 'Centro Comercial Único Outlet' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1481437156560-3205f6a55735?w=1200&q=80', 'Tiendas outlet con descuentos', false, 1),
((SELECT id FROM public.places WHERE name = 'Centro Comercial Único Outlet' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=1200&q=80', 'Pasillo del outlet con ofertas', false, 2),
((SELECT id FROM public.places WHERE name = 'Centro Comercial Único Outlet' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=1200&q=80', 'Patio de comidas con opciones rápidas', false, 3),
((SELECT id FROM public.places WHERE name = 'Centro Comercial Único Outlet' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1591085686350-798c0f9faa7f?w=1200&q=80', 'Tres pisos del centro comercial', false, 4);

-- Zoológico de Barranquilla
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Zoológico de Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1551983208-fd34d4b0eb73?w=1200&q=80', 'Zoológico de Barranquilla animales', true, 0),
((SELECT id FROM public.places WHERE name = 'Zoológico de Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1568822617270-2c1579f8dfe2?w=1200&q=80', 'Tigres en hábitat natural', false, 1),
((SELECT id FROM public.places WHERE name = 'Zoológico de Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=1200&q=80', 'Aves tropicales colombianas', false, 2),
((SELECT id FROM public.places WHERE name = 'Zoológico de Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=1200&q=80', 'Primates en exhibición', false, 3),
((SELECT id FROM public.places WHERE name = 'Zoológico de Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1535338454770-8be927b5a00b?w=1200&q=80', 'Programa educativo para visitantes', false, 4),
((SELECT id FROM public.places WHERE name = 'Zoológico de Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1485594050903-8e8ee7b071a8?w=1200&q=80', 'Hábitats diseñados a escala natural', false, 5),
((SELECT id FROM public.places WHERE name = 'Zoológico de Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=1200&q=80', 'Visita guiada familiar', false, 6);

-- Parque Sagrado Corazón
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Parque Sagrado Corazón' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1568822617270-2c1579f8dfe2?w=1200&q=80', 'Parque Sagrado Corazón centro', true, 0),
((SELECT id FROM public.places WHERE name = 'Parque Sagrado Corazón' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1551983208-fd34d4b0eb73?w=1200&q=80', 'Lago artificial con patos', false, 1),
((SELECT id FROM public.places WHERE name = 'Parque Sagrado Corazón' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=1200&q=80', 'Senderos arbolados para correr', false, 2),
((SELECT id FROM public.places WHERE name = 'Parque Sagrado Corazón' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=1200&q=80', 'Estatua del Sagrado Corazón', false, 3),
((SELECT id FROM public.places WHERE name = 'Parque Sagrado Corazón' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1485594050903-8e8ee7b071a8?w=1200&q=80', 'Familias disfrutando del parque', false, 4);

-- Ciénaga de Mallorquín
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Ciénaga de Mallorquín' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=1200&q=80', 'Ciénaga de Mallorquín humedal', true, 0),
((SELECT id FROM public.places WHERE name = 'Ciénaga de Mallorquín' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1568822617270-2c1579f8dfe2?w=1200&q=80', 'Aves migratorias en vuelo', false, 1),
((SELECT id FROM public.places WHERE name = 'Ciénaga de Mallorquín' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1551983208-fd34d4b0eb73?w=1200&q=80', 'Tour en canoa por la ciénaga', false, 2),
((SELECT id FROM public.places WHERE name = 'Ciénaga de Mallorquín' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1535338454770-8be927b5a00b?w=1200&q=80', 'Garzas en su hábitat natural', false, 3),
((SELECT id FROM public.places WHERE name = 'Ciénaga de Mallorquín' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=1200&q=80', 'Restaurantes a la orilla del humedal', false, 4),
((SELECT id FROM public.places WHERE name = 'Ciénaga de Mallorquín' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=1200&q=80', 'Paisaje natural del humedal', false, 5);

-- Jardín Botánico de Barranquilla
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Jardín Botánico de Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=1200&q=80', 'Jardín Botánico flora caribeña', true, 0),
((SELECT id FROM public.places WHERE name = 'Jardín Botánico de Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1551983208-fd34d4b0eb73?w=1200&q=80', 'Orquidiario con especies exóticas', false, 1),
((SELECT id FROM public.places WHERE name = 'Jardín Botánico de Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1568822617270-2c1579f8dfe2?w=1200&q=80', 'Mariposario con especies coloridas', false, 2),
((SELECT id FROM public.places WHERE name = 'Jardín Botánico de Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=1200&q=80', 'Senderos del jardín botánico', false, 3),
((SELECT id FROM public.places WHERE name = 'Jardín Botánico de Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1535338454770-8be927b5a00b?w=1200&q=80', 'Taller ambiental con niños', false, 4),
((SELECT id FROM public.places WHERE name = 'Jardín Botánico de Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1485594050903-8e8ee7b071a8?w=1200&q=80', 'Cafetería con productos orgánicos', false, 5);

-- Parque Ecológico Mundo Marino
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Parque Ecológico Mundo Marino' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1535338454770-8be927b5a00b?w=1200&q=80', 'Acuarios interactivos del Mundo Marino', true, 0),
((SELECT id FROM public.places WHERE name = 'Parque Ecológico Mundo Marino' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=1200&q=80', 'Tortuga marina en rehabilitación', false, 1),
((SELECT id FROM public.places WHERE name = 'Parque Ecológico Mundo Marino' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1551983208-fd34d4b0eb73?w=1200&q=80', 'Touch pool con estrellas de mar', false, 2),
((SELECT id FROM public.places WHERE name = 'Parque Ecológico Mundo Marino' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1568822617270-2c1579f8dfe2?w=1200&q=80', 'Peces tropicales del Caribe', false, 3),
((SELECT id FROM public.places WHERE name = 'Parque Ecológico Mundo Marino' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=1200&q=80', 'Visita guiada educativa', false, 4),
((SELECT id FROM public.places WHERE name = 'Parque Ecológico Mundo Marino' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1485594050903-8e8ee7b071a8?w=1200&q=80', 'Centro de investigación marina', false, 5);

-- Estadio Metropolitano Roberto Meléndez
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Estadio Metropolitano Roberto Meléndez' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1577223625816-7546f13df25d?w=1200&q=80', 'Estadio Metropolitano vista aérea', true, 0),
((SELECT id FROM public.places WHERE name = 'Estadio Metropolitano Roberto Meléndez' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&q=80', 'Cancha desde las tribunas', false, 1),
((SELECT id FROM public.places WHERE name = 'Estadio Metropolitano Roberto Meléndez' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1518604666860-9ed391f76460?w=1200&q=80', 'Hinchada del Junior en partido', false, 2),
((SELECT id FROM public.places WHERE name = 'Estadio Metropolitano Roberto Meléndez' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1565017228812-ddedc63277a2?w=1200&q=80', 'Vestuarios oficiales del estadio', false, 3),
((SELECT id FROM public.places WHERE name = 'Estadio Metropolitano Roberto Meléndez' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1556056504-5c7696c4c28d?w=1200&q=80', 'Museo del Junior dentro del complejo', false, 4),
((SELECT id FROM public.places WHERE name = 'Estadio Metropolitano Roberto Meléndez' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1606925797300-0b35e9d1794e?w=1200&q=80', 'Fachada exterior del estadio', false, 5);

-- Country Club Barranquilla
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Country Club Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&q=80', 'Campo de golf del Country Club', true, 0),
((SELECT id FROM public.places WHERE name = 'Country Club Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1577223625816-7546f13df25d?w=1200&q=80', 'Canchas de tenis profesionales', false, 1),
((SELECT id FROM public.places WHERE name = 'Country Club Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1518604666860-9ed391f76460?w=1200&q=80', 'Piscina olímpica del club', false, 2),
((SELECT id FROM public.places WHERE name = 'Country Club Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1565017228812-ddedc63277a2?w=1200&q=80', 'Restaurante del club exclusivo', false, 3),
((SELECT id FROM public.places WHERE name = 'Country Club Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1556056504-5c7696c4c28d?w=1200&q=80', 'Gimnasio completamente equipado', false, 4),
((SELECT id FROM public.places WHERE name = 'Country Club Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1606925797300-0b35e9d1794e?w=1200&q=80', 'Casa club tradicional', false, 5);

-- Centro de Alto Rendimiento Elías Chegwin
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Centro de Alto Rendimiento Elías Chegwin' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1518604666860-9ed391f76460?w=1200&q=80', 'Piscina olímpica Elías Chegwin', true, 0),
((SELECT id FROM public.places WHERE name = 'Centro de Alto Rendimiento Elías Chegwin' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1577223625816-7546f13df25d?w=1200&q=80', 'Pista de atletismo profesional', false, 1),
((SELECT id FROM public.places WHERE name = 'Centro de Alto Rendimiento Elías Chegwin' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&q=80', 'Coliseo de entrenamiento', false, 2),
((SELECT id FROM public.places WHERE name = 'Centro de Alto Rendimiento Elías Chegwin' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1565017228812-ddedc63277a2?w=1200&q=80', 'Deportistas entrenando', false, 3),
((SELECT id FROM public.places WHERE name = 'Centro de Alto Rendimiento Elías Chegwin' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1556056504-5c7696c4c28d?w=1200&q=80', 'Clases de natación para principiantes', false, 4);

-- Club Náutico de Barranquilla
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Club Náutico de Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1565017228812-ddedc63277a2?w=1200&q=80', 'Marina del Club Náutico', true, 0),
((SELECT id FROM public.places WHERE name = 'Club Náutico de Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1577223625816-7546f13df25d?w=1200&q=80', 'Veleros en el río Magdalena', false, 1),
((SELECT id FROM public.places WHERE name = 'Club Náutico de Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1518604666860-9ed391f76460?w=1200&q=80', 'Práctica de kayak en aguas calmadas', false, 2),
((SELECT id FROM public.places WHERE name = 'Club Náutico de Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&q=80', 'Jet ski y wakeboard', false, 3),
((SELECT id FROM public.places WHERE name = 'Club Náutico de Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1556056504-5c7696c4c28d?w=1200&q=80', 'Restaurante con vista al río', false, 4),
((SELECT id FROM public.places WHERE name = 'Club Náutico de Barranquilla' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1606925797300-0b35e9d1794e?w=1200&q=80', 'Embarcadero del club náutico', false, 5);

-- Coliseo Cubierto Humberto Perea
INSERT INTO public.place_photos (place_id, url, alt_text, is_cover, display_order) VALUES
((SELECT id FROM public.places WHERE name = 'Coliseo Cubierto Humberto Perea' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1556056504-5c7696c4c28d?w=1200&q=80', 'Coliseo Cubierto Humberto Perea', true, 0),
((SELECT id FROM public.places WHERE name = 'Coliseo Cubierto Humberto Perea' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1577223625816-7546f13df25d?w=1200&q=80', 'Partido de baloncesto en el coliseo', false, 1),
((SELECT id FROM public.places WHERE name = 'Coliseo Cubierto Humberto Perea' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&q=80', 'Concierto multitudinario', false, 2),
((SELECT id FROM public.places WHERE name = 'Coliseo Cubierto Humberto Perea' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1518604666860-9ed391f76460?w=1200&q=80', 'Tribunas con capacidad para 7000', false, 3),
((SELECT id FROM public.places WHERE name = 'Coliseo Cubierto Humberto Perea' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1565017228812-ddedc63277a2?w=1200&q=80', 'Cancha de voleibol en torneo', false, 4),
((SELECT id FROM public.places WHERE name = 'Coliseo Cubierto Humberto Perea' ORDER BY created_at DESC LIMIT 1), 'https://images.unsplash.com/photo-1606925797300-0b35e9d1794e?w=1200&q=80', 'Fachada del coliseo céntrico', false, 5);

-- ============================================================================
-- SPONSORSHIPS
-- ============================================================================

UPDATE public.places
SET is_sponsored = true,
    sponsored_until = now() + interval '60 days',
    sponsored_at = now() - interval '5 days'
WHERE name IN (
  'La Cueva Restaurante',
  'Cocina 33',
  'Bocas de Ceniza',
  'Castillo de Salgar',
  'Frogg Leggs Pub',
  'Hotel Estelar En Alto Prado',
  'Tour Carnaval de Barranquilla',
  'Museo del Caribe'
);-- ============================================================================
-- SECTION 3: Experiences + photos + slots + reservations + reviews
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 Experiences (30 total, 3 per operator place)
-- ----------------------------------------------------------------------------

-- Operator 001: restaurantes
INSERT INTO public.experiences (operator_place_id, title, description, experience_type, tags, duration_minutes, price_cop, min_participants, max_participants, meeting_point_address, meeting_point_latitude, meeting_point_longitude, cancellation_hours, is_active)
VALUES
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_001@xitty.local') LIMIT 1),
   'Cena de mariscos al atardecer en Las Flores',
   'Disfruta de una cena exclusiva frente al río Magdalena con los mejores mariscos del Caribe colombiano. Nuestro chef preparará un menú degustación de cinco tiempos maridado con vinos seleccionados. La experiencia incluye un recorrido por la cocina y explicaciones sobre los ingredientes locales. Una velada inolvidable con vista al atardecer barranquillero.',
   'gastronomy', ARRAY['mariscos','atardecer','cena','río magdalena','degustación'], 180, 185000, 2, 12,
   'Vía 40 con Calle 70, Las Flores', 11.0185, -74.8421, 24, true),
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_001@xitty.local') LIMIT 1),
   'Taller de cocina caribeña tradicional',
   'Aprende a preparar los platos típicos del Caribe colombiano con nuestro chef experto. Cocinaremos sancocho de pescado, arroz con coco y patacones desde cero. La clase incluye todos los ingredientes, delantal de regalo y un recetario digital. Termina la experiencia disfrutando de tu propia creación acompañada de bebidas típicas.',
   'workshop', ARRAY['cocina','taller','tradicional','caribe','clase'], 240, 145000, 2, 10,
   'Carrera 50 con Calle 76, Norte', 11.0025, -74.8095, 48, true),
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_001@xitty.local') LIMIT 1),
   'Ruta gastronómica por el mercado de Barranquillita',
   'Recorre el mercado más auténtico de Barranquilla acompañado de un guía local y degusta frutas exóticas, fritos costeños y jugos naturales. Conocerás la historia detrás de cada plato y aprenderás a identificar los mejores ingredientes. La ruta incluye seis paradas con degustaciones en cada una. Una inmersión total en el sabor barranquillero.',
   'gastronomy', ARRAY['mercado','tour','degustación','local','frutas'], 150, 75000, 1, 15,
   'Calle 30 con Carrera 38, Barranquillita', 10.9722, -74.7935, 24, true);

-- Operator 002: sitios-turisticos
INSERT INTO public.experiences (operator_place_id, title, description, experience_type, tags, duration_minutes, price_cop, min_participants, max_participants, meeting_point_address, meeting_point_latitude, meeting_point_longitude, cancellation_hours, is_active)
VALUES
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_002@xitty.local') LIMIT 1),
   'Tour fotográfico por el Centro Histórico',
   'Captura la esencia de Barranquilla con un fotógrafo profesional que te guiará por los rincones más icónicos del Centro Histórico. Aprenderás técnicas básicas de fotografía urbana mientras descubres el patrimonio republicano de la ciudad. El tour incluye edición express de tus mejores tomas. Llévate un álbum digital de recuerdo de tu visita.',
   'tour', ARRAY['fotografía','centro histórico','patrimonio','arquitectura','urbano'], 180, 95000, 1, 8,
   'Plaza San Nicolás, Centro', 10.9685, -74.7825, 24, true),
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_002@xitty.local') LIMIT 1),
   'City tour panorámico en bus turístico',
   'Conoce los puntos más emblemáticos de Barranquilla en un cómodo bus descapotable con audioguía en español e inglés. Recorreremos el Centro Histórico, el Prado, el Estadio Metropolitano y el malecón del río. Incluye dos paradas para fotos y una bebida de bienvenida. Ideal para una primera aproximación a la ciudad.',
   'tour', ARRAY['city tour','bus','panorámico','audioguía','familiar'], 120, 55000, 1, 15,
   'Plaza de la Paz, Catedral Metropolitana', 10.9963, -74.7975, 24, true),
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_002@xitty.local') LIMIT 1),
   'Recorrido nocturno iluminado por Barranquilla',
   'Descubre Barranquilla bajo otra luz con un recorrido nocturno por los monumentos más iluminados de la ciudad. Visitaremos la Ventana al Mundo, el Gran Malecón y el Puente Pumarejo. La experiencia incluye paradas para tomar fotos espectaculares y una cena ligera. Perfecto para parejas y grupos pequeños.',
   'tour', ARRAY['nocturno','iluminado','monumentos','malecón','romántico'], 180, 110000, 2, 12,
   'Ventana al Mundo, Vía 40', 11.0145, -74.8195, 48, true);

-- Operator 003: bares-vida-nocturna
INSERT INTO public.experiences (operator_place_id, title, description, experience_type, tags, duration_minutes, price_cop, min_participants, max_participants, meeting_point_address, meeting_point_latitude, meeting_point_longitude, cancellation_hours, is_active)
VALUES
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_003@xitty.local') LIMIT 1),
   'Ruta de bares en La Concepción',
   'Vive la noche barranquillera con un pub crawl por los mejores bares de La Concepción. Visitaremos cuatro locales con shots de bienvenida en cada uno y un cóctel especial al final. Nuestro anfitrión local te contará las mejores anécdotas del barrio bohemio. Una noche garantizada de música, baile y nuevos amigos.',
   'nightlife', ARRAY['pub crawl','bares','concepción','tragos','noche'], 240, 120000, 2, 12,
   'Calle 70 con Carrera 53, La Concepción', 11.0055, -74.8125, 12, true),
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_003@xitty.local') LIMIT 1),
   'Taller de coctelería caribeña con ron',
   'Aprende a preparar los cócteles más representativos del Caribe colombiano de la mano de un bartender campeón. Mezclaremos mojitos, daiquiris y creaciones propias con ron añejo nacional. Cada participante recibe su kit de bartender básico para llevar. Termina catando las tres mejores referencias de ron de la región.',
   'workshop', ARRAY['coctelería','ron','bartender','taller','caribe'], 180, 165000, 2, 10,
   'Carrera 53 con Calle 75, El Prado', 11.0015, -74.8105, 48, true),
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_003@xitty.local') LIMIT 1),
   'Noche de salsa y son cubano en vivo',
   'Disfruta de una noche auténtica con orquesta de salsa en vivo en uno de los locales más tradicionales de la ciudad. La entrada incluye cena, primer trago y mesa reservada cerca del escenario. Profesores de baile estarán disponibles para una mini clase antes del show. La rumba está garantizada hasta la madrugada.',
   'nightlife', ARRAY['salsa','en vivo','son cubano','baile','rumba'], 300, 145000, 2, 14,
   'Calle 84 con Carrera 51, Alto Prado', 11.0095, -74.8055, 24, true);

-- Operator 004: experiencias
INSERT INTO public.experiences (operator_place_id, title, description, experience_type, tags, duration_minutes, price_cop, min_participants, max_participants, meeting_point_address, meeting_point_latitude, meeting_point_longitude, cancellation_hours, is_active)
VALUES
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_004@xitty.local') LIMIT 1),
   'Clase de cumbia y salsa para principiantes',
   'Aprende los pasos básicos de la cumbia y la salsa con bailarines profesionales del Carnaval de Barranquilla. La clase incluye una breve historia de cada ritmo y vestuario tradicional para fotos. Practicaremos con música en vivo de instrumentos típicos. Llévate un video personalizado bailando como un verdadero costeño.',
   'cultural', ARRAY['cumbia','salsa','baile','clase','carnaval'], 120, 65000, 1, 15,
   'Carrera 46 con Calle 72, El Prado', 11.0005, -74.8085, 24, true),
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_004@xitty.local') LIMIT 1),
   'Taller de máscaras del Carnaval de Barranquilla',
   'Sumérgete en la tradición del Carnaval creando tu propia máscara de marimonda o tigrillo. Un artesano local te guiará en cada paso desde el moldeado hasta la decoración. La actividad incluye todos los materiales y una explicación sobre el origen de cada personaje. Llévate tu obra terminada como recuerdo único.',
   'workshop', ARRAY['carnaval','máscaras','artesanía','marimonda','taller'], 180, 95000, 1, 10,
   'Calle 17 con Carrera 54, Barrio Abajo', 10.9785, -74.8005, 48, true),
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_004@xitty.local') LIMIT 1),
   'Experiencia inmersiva en la cultura costeña',
   'Vive un día completo de inmersión en la cultura del Caribe colombiano con música, comida y tradiciones. Incluye visita a un tambor maker, clase de percusión y degustación de comidas regionales. Terminamos con un fandango bailable con cumbia, mapalé y porro. Una experiencia 360 de la identidad caribe.',
   'cultural', ARRAY['cultura','inmersiva','costeño','tambor','fandango'], 300, 175000, 2, 12,
   'Calle 30 con Carrera 43, Barrio Abajo', 10.9745, -74.8015, 48, true);

-- Operator 005: hoteles
INSERT INTO public.experiences (operator_place_id, title, description, experience_type, tags, duration_minutes, price_cop, min_participants, max_participants, meeting_point_address, meeting_point_latitude, meeting_point_longitude, cancellation_hours, is_active)
VALUES
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_005@xitty.local') LIMIT 1),
   'Coctelería en el rooftop del hotel',
   'Disfruta de la mejor vista panorámica de Barranquilla desde nuestro rooftop con una experiencia de mixología premium. Nuestro bartender preparará cuatro cócteles de autor frente a ti con ingredientes locales. Incluye tabla de quesos artesanales y música DJ en vivo. La velada perfecta para celebrar momentos especiales.',
   'gastronomy', ARRAY['rooftop','coctelería','vista panorámica','mixología','premium'], 180, 195000, 2, 14,
   'Carrera 53 con Calle 79, Alto Prado', 11.0075, -74.8105, 24, true),
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_005@xitty.local') LIMIT 1),
   'Spa day con masaje caribe y piscina',
   'Relájate con un día completo de spa que incluye masaje terapéutico con aceites del Caribe y acceso a la piscina infinity. La experiencia comprende tres horas de tratamientos personalizados y un almuerzo saludable. Bata, chanclas y kit de spa incluidos. El plan ideal para desconectarse del estrés y reconectar con uno mismo.',
   'wellness', ARRAY['spa','masaje','piscina','wellness','relajación'], 360, 285000, 1, 8,
   'Carrera 51B con Calle 87, Alto Prado', 11.0125, -74.8085, 48, true),
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_005@xitty.local') LIMIT 1),
   'Brunch dominical buffet caribeño',
   'Comienza el domingo con nuestro brunch buffet de cocina caribeña fusión internacional. La mesa incluye más de cuarenta opciones desde frutas tropicales hasta platos calientes recién preparados. Bebidas ilimitadas durante dos horas: jugos naturales, café, mimosas y bloody marys. Ambiente musical en vivo con bossa nova y jazz.',
   'gastronomy', ARRAY['brunch','buffet','dominical','caribeño','mimosas'], 150, 125000, 1, 15,
   'Calle 84 con Carrera 53, Alto Prado', 11.0095, -74.8075, 24, true);

-- Operator 006: playas
INSERT INTO public.experiences (operator_place_id, title, description, experience_type, tags, duration_minutes, price_cop, min_participants, max_participants, meeting_point_address, meeting_point_latitude, meeting_point_longitude, cancellation_hours, is_active)
VALUES
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_006@xitty.local') LIMIT 1),
   'Snorkel en Pradomar con instructor certificado',
   'Explora los arrecifes de Pradomar acompañado por instructores PADI certificados. La actividad incluye todo el equipo de snorkel, chaleco salvavidas y briefing de seguridad. Nadarás entre peces tropicales en aguas cristalinas. Termina la experiencia con frutas frescas y cocadas artesanales en la playa.',
   'adventure', ARRAY['snorkel','playa','pradomar','arrecife','aventura'], 180, 135000, 2, 10,
   'Vía Puerto Colombia km 12, Pradomar', 10.9985, -74.8625, 24, true),
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_006@xitty.local') LIMIT 1),
   'Día de playa todo incluido en Salgar',
   'Pasa un día completo en la playa de Salgar con todo incluido: sombrilla, silla, almuerzo típico y bebidas ilimitadas. Disfruta del mar Caribe en una de las playas más limpias de la región. Incluye paseo en banana boat y una hora de jet ski. Transporte ida y vuelta desde el norte de Barranquilla.',
   'adventure', ARRAY['playa','salgar','todo incluido','banana boat','jet ski'], 360, 165000, 1, 15,
   'Vía al Mar km 8, Salgar', 11.0185, -74.8595, 48, true),
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_006@xitty.local') LIMIT 1),
   'Caminata costera al atardecer en Puerto Velero',
   'Camina por la costa caribe al atardecer descubriendo formaciones rocosas y fauna marina. El guía explica la geología y ecosistema costero de la región. Termina con una cena ligera de pescado fresco frente al mar. Una experiencia tranquila y reconectiva con la naturaleza.',
   'wellness', ARRAY['caminata','atardecer','costa','puerto velero','naturaleza'], 180, 85000, 2, 12,
   'Vía Puerto Velero km 18, Puerto Velero', 11.0245, -74.8595, 24, true);

-- Operator 007: cultura
INSERT INTO public.experiences (operator_place_id, title, description, experience_type, tags, duration_minutes, price_cop, min_participants, max_participants, meeting_point_address, meeting_point_latitude, meeting_point_longitude, cancellation_hours, is_active)
VALUES
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_007@xitty.local') LIMIT 1),
   'Visita guiada al Museo del Caribe',
   'Descubre la historia y cultura del Caribe colombiano con un recorrido guiado por todas las salas del Museo del Caribe. Tu guía especializado profundizará en la sala García Márquez y la sala de la palabra. La entrada incluye acceso a la exposición temporal vigente. Llévate un libro de regalo sobre la cultura caribe.',
   'cultural', ARRAY['museo','caribe','guiada','garcía márquez','historia'], 120, 55000, 1, 15,
   'Calle 36 con Carrera 46, Centro', 10.9805, -74.7945, 24, true),
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_007@xitty.local') LIMIT 1),
   'Tour literario por la Barranquilla de García Márquez',
   'Recorre los lugares que inspiraron a Gabo durante su vida en Barranquilla. Visitarás La Cueva, El Heraldo y los bares que frecuentaba el Grupo de Barranquilla. El guía es un periodista experto en la obra de García Márquez. Termina la experiencia con un café en su mesa favorita.',
   'cultural', ARRAY['literatura','gabo','garcía márquez','la cueva','heraldo'], 180, 85000, 1, 10,
   'Carrera 43 con Calle 59, El Prado', 10.9945, -74.8075, 24, true),
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_007@xitty.local') LIMIT 1),
   'Recorrido por el Teatro Amira de la Rosa y zona cultural',
   'Conoce uno de los teatros más emblemáticos de la ciudad con un tour backstage exclusivo. Visitarás camerinos, escenario y cabinas técnicas mientras conoces la historia del teatro. El recorrido incluye charla con un actor local y entradas para una función. Una experiencia única para amantes de las artes escénicas.',
   'cultural', ARRAY['teatro','amira de la rosa','backstage','artes escénicas','tour'], 150, 75000, 2, 12,
   'Carrera 54 con Calle 52, Centro', 10.9885, -74.7965, 48, true);

-- Operator 008: compras
INSERT INTO public.experiences (operator_place_id, title, description, experience_type, tags, duration_minutes, price_cop, min_participants, max_participants, meeting_point_address, meeting_point_latitude, meeting_point_longitude, cancellation_hours, is_active)
VALUES
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_008@xitty.local') LIMIT 1),
   'Tour de boutiques en Alto Prado',
   'Descubre las mejores boutiques de diseñadores locales con un personal shopper experto en moda caribeña. Visitaremos cinco tiendas seleccionadas con descuentos exclusivos para participantes. Incluye champagne de bienvenida y snacks gourmet entre paradas. Llévate un look completo con asesoría personalizada.',
   'tour', ARRAY['shopping','boutiques','moda','alto prado','personal shopper'], 240, 145000, 1, 8,
   'Carrera 51B con Calle 84, Alto Prado', 11.0095, -74.8085, 24, true),
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_008@xitty.local') LIMIT 1),
   'Ruta de artesanías y souvenirs auténticos',
   'Conoce los talleres artesanales más auténticos donde se producen las mochilas wayúu, sombreros vueltiao y joyería en filigrana. Cada parada incluye demostración del oficio y posibilidad de comprar directamente del artesano. Un porcentaje de las ventas apoya proyectos comunitarios. Llévate piezas únicas con historia.',
   'cultural', ARRAY['artesanías','souvenirs','wayúu','vueltiao','filigrana'], 180, 65000, 1, 12,
   'Calle 17 con Carrera 38, Barrio Abajo', 10.9755, -74.8025, 24, true),
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_008@xitty.local') LIMIT 1),
   'Experiencia VIP en centro comercial premium',
   'Disfruta de una jornada VIP de compras con valet parking, acceso a lounge privado y descuentos exclusivos en más de treinta marcas. Incluye sesión con asesor de imagen y almuerzo en restaurante premium. Servicio de carga y empaque de regalo gratuito. Pensado para clientes que buscan la mejor experiencia.',
   'wellness', ARRAY['VIP','shopping','centro comercial','asesor','premium'], 300, 215000, 1, 6,
   'Calle 110 con Carrera 53, Buenavista', 11.0285, -74.8115, 48, true);

-- Operator 009: naturaleza
INSERT INTO public.experiences (operator_place_id, title, description, experience_type, tags, duration_minutes, price_cop, min_participants, max_participants, meeting_point_address, meeting_point_latitude, meeting_point_longitude, cancellation_hours, is_active)
VALUES
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_009@xitty.local') LIMIT 1),
   'Avistamiento de aves en el manglar de Mallorquín',
   'Observa más de cincuenta especies de aves en la ciénaga de Mallorquín con un biólogo experto. La actividad incluye binoculares profesionales, guía ilustrado y desayuno tipo lunch. Recorreremos en kayak por canales del manglar al amanecer. Una experiencia ideal para birdwatchers y amantes de la naturaleza.',
   'adventure', ARRAY['aves','manglar','mallorquín','birdwatching','kayak'], 240, 165000, 2, 10,
   'Vía 40 km 15, Ciénaga de Mallorquín', 11.0385, -74.8485, 24, true),
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_009@xitty.local') LIMIT 1),
   'Recorrido ecológico por el río Magdalena',
   'Navega por el río Magdalena en lancha rápida descubriendo su biodiversidad y comunidades ribereñas. Visitaremos un pueblo palafítico y una reserva natural privada. El recorrido incluye almuerzo típico ribereño y bebidas. Aprende sobre la importancia del Magdalena para la cultura colombiana.',
   'adventure', ARRAY['río magdalena','ecológico','lancha','biodiversidad','palafítico'], 300, 195000, 2, 12,
   'Embarcadero Las Flores, Vía 40', 11.0205, -74.8425, 48, true),
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_009@xitty.local') LIMIT 1),
   'Senderismo guiado en la Sierra Nevada',
   'Aventúrate en un trekking guiado por las estribaciones de la Sierra Nevada de Santa Marta saliendo desde Barranquilla. La caminata de seis horas incluye cascadas, miradores y pausa para almuerzo orgánico. Apto para personas con condición física media. Transporte ida y vuelta y todo el equipo de seguridad incluido.',
   'adventure', ARRAY['senderismo','sierra nevada','trekking','cascadas','aventura'], 360, 235000, 2, 12,
   'Vía Ciénaga km 5, Pumarejo', 11.0285, -74.7845, 48, true);

-- Operator 010: deportes
INSERT INTO public.experiences (operator_place_id, title, description, experience_type, tags, duration_minutes, price_cop, min_participants, max_participants, meeting_point_address, meeting_point_latitude, meeting_point_longitude, cancellation_hours, is_active)
VALUES
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_010@xitty.local') LIMIT 1),
   'Clase de kitesurf en Salgar para principiantes',
   'Aprende kitesurf en una de las mejores zonas del Caribe con instructores IKO certificados. La clase incluye equipo completo, traje de neopreno y briefing teórico. Aprovecharemos los vientos óptimos de la tarde para tu primera salida al agua. Llévate un diploma de iniciación y la garantía de querer volver.',
   'adventure', ARRAY['kitesurf','salgar','principiantes','IKO','viento'], 240, 285000, 1, 6,
   'Playa de Salgar km 9, Salgar', 11.0195, -74.8615, 48, true),
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_010@xitty.local') LIMIT 1),
   'Tour en bicicleta por el Gran Malecón',
   'Recorre el Gran Malecón del Río en bicicleta acompañado de un guía local. La ruta de quince kilómetros incluye paradas en monumentos, parques y miradores. Bicicleta, casco e hidratación incluidos durante todo el recorrido. Termina con una bebida fría en uno de los kioscos del malecón.',
   'adventure', ARRAY['bicicleta','malecón','tour','ciclismo','río'], 180, 75000, 2, 15,
   'Gran Malecón del Río, entrada principal', 11.0095, -74.8125, 24, true),
  ((SELECT id FROM public.places WHERE owner_id = (SELECT id FROM public.profiles WHERE email = 'seed_dueno_010@xitty.local') LIMIT 1),
   'Sesión de paddle surf al amanecer',
   'Inicia el día con una sesión de paddle surf en aguas tranquilas con vista al amanecer caribeño. Apto para todos los niveles con clase introductoria de quince minutos. Incluye tabla, remo y chaleco salvavidas. Termina con desayuno saludable frente al mar con jugo de frutas naturales.',
   'wellness', ARRAY['paddle surf','amanecer','wellness','SUP','principiante'], 120, 115000, 1, 8,
   'Playa de Puerto Colombia, muelle', 10.9885, -74.9485, 24, true);

-- ----------------------------------------------------------------------------
-- 3.2 Experience photos (3-5 per experience, one cover)
-- ----------------------------------------------------------------------------

DO $exp_photos$
DECLARE
  exp_record RECORD;
  photo_pool_food TEXT[] := ARRAY[
    'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=1200&q=80',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80',
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1200&q=80',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80',
    'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1200&q=80'
  ];
  photo_pool_tour TEXT[] := ARRAY[
    'https://images.unsplash.com/photo-1539635278303-d4002c07eae3?w=1200&q=80',
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&q=80',
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&q=80',
    'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=1200&q=80',
    'https://images.unsplash.com/photo-1543351611-58f69d7c1781?w=1200&q=80'
  ];
  photo_pool_workshop TEXT[] := ARRAY[
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200&q=80',
    'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=1200&q=80',
    'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=1200&q=80',
    'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&q=80',
    'https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=1200&q=80'
  ];
  photo_pool_beach TEXT[] := ARRAY[
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80',
    'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200&q=80',
    'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?w=1200&q=80',
    'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1200&q=80',
    'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=1200&q=80'
  ];
  photo_pool_adventure TEXT[] := ARRAY[
    'https://images.unsplash.com/photo-1533577116850-9cc66cad8a9b?w=1200&q=80',
    'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=1200&q=80',
    'https://images.unsplash.com/photo-1551632811-561732d1e306?w=1200&q=80',
    'https://images.unsplash.com/photo-1518364538800-6bae3c2ea0f2?w=1200&q=80',
    'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=1200&q=80'
  ];
  photo_pool_culture TEXT[] := ARRAY[
    'https://images.unsplash.com/photo-1577083552431-6e5fd01988ec?w=1200&q=80',
    'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=1200&q=80',
    'https://images.unsplash.com/photo-1545987796-200677ee1011?w=1200&q=80',
    'https://images.unsplash.com/photo-1551503766-ac63dfa6401c?w=1200&q=80',
    'https://images.unsplash.com/photo-1583067456220-d92f0e9b4ca6?w=1200&q=80'
  ];
  photo_pool_nightlife TEXT[] := ARRAY[
    'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1200&q=80',
    'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=1200&q=80',
    'https://images.unsplash.com/photo-1583227122027-d2d3f5d2a1be?w=1200&q=80',
    'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=1200&q=80',
    'https://images.unsplash.com/photo-1572116469741-6c9b07f5e62a?w=1200&q=80'
  ];
  photo_pool_wellness TEXT[] := ARRAY[
    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1200&q=80',
    'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1200&q=80',
    'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=1200&q=80',
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&q=80',
    'https://images.unsplash.com/photo-1559599101-f09722fb4948?w=1200&q=80'
  ];
  selected_pool TEXT[];
  photo_count INT;
  i INT;
BEGIN
  FOR exp_record IN SELECT id, experience_type, title FROM public.experiences LOOP
    selected_pool := CASE exp_record.experience_type
      WHEN 'gastronomy' THEN photo_pool_food
      WHEN 'tour' THEN photo_pool_tour
      WHEN 'workshop' THEN photo_pool_workshop
      WHEN 'adventure' THEN
        CASE WHEN exp_record.title ILIKE '%playa%' OR exp_record.title ILIKE '%snorkel%' OR exp_record.title ILIKE '%paddle%' OR exp_record.title ILIKE '%salgar%' THEN photo_pool_beach
             ELSE photo_pool_adventure END
      WHEN 'cultural' THEN photo_pool_culture
      WHEN 'nightlife' THEN photo_pool_nightlife
      WHEN 'wellness' THEN photo_pool_wellness
      ELSE photo_pool_tour
    END;

    photo_count := 3 + (floor(random() * 3))::INT;
    FOR i IN 1..photo_count LOOP
      INSERT INTO public.experience_photos (experience_id, url, alt_text, is_cover, display_order)
      VALUES (
        exp_record.id,
        selected_pool[((i - 1) % array_length(selected_pool, 1)) + 1],
        'Foto de ' || exp_record.title,
        (i = 1),
        i - 1
      );
    END LOOP;
  END LOOP;
END
$exp_photos$;

-- ----------------------------------------------------------------------------
-- 3.3 Experience slots (10 per experience: 3 past, 1 today, 6 future)
-- ----------------------------------------------------------------------------

DO $exp_slots$
DECLARE
  exp_record RECORD;
  past_days INT[] := ARRAY[5, 14, 25];
  future_days INT[] := ARRAY[2, 7, 14, 21, 30, 42];
  d INT;
  cap SMALLINT;
BEGIN
  FOR exp_record IN SELECT id FROM public.experiences LOOP
    -- 3 past slots
    FOREACH d IN ARRAY past_days LOOP
      cap := (10 + (floor(random() * 6)))::SMALLINT;
      INSERT INTO public.experience_slots (experience_id, starts_at, capacity, is_active)
      VALUES (exp_record.id, now() - (d || ' days')::interval + interval '15 hours', cap, true)
      ON CONFLICT (experience_id, starts_at) DO NOTHING;
    END LOOP;

    -- 1 today slot (a few hours in the future)
    cap := (10 + (floor(random() * 6)))::SMALLINT;
    INSERT INTO public.experience_slots (experience_id, starts_at, capacity, is_active)
    VALUES (exp_record.id, date_trunc('day', now()) + interval '20 hours', cap, true)
    ON CONFLICT (experience_id, starts_at) DO NOTHING;

    -- 6 future slots
    FOREACH d IN ARRAY future_days LOOP
      cap := (10 + (floor(random() * 6)))::SMALLINT;
      INSERT INTO public.experience_slots (experience_id, starts_at, capacity, is_active)
      VALUES (exp_record.id, now() + (d || ' days')::interval + interval '16 hours', cap, true)
      ON CONFLICT (experience_id, starts_at) DO NOTHING;
    END LOOP;
  END LOOP;
END
$exp_slots$;

-- ----------------------------------------------------------------------------
-- 3.4 Reservations
-- For past slots: 2-4 completed reservations
-- For today slot: 1-2 confirmed
-- For future slots: 1-3 confirmed plus occasional cancelled
-- Total participants per slot kept <= capacity - 2
-- ----------------------------------------------------------------------------

DO $exp_reservations$
DECLARE
  slot_record RECORD;
  reservation_count INT;
  participants_value SMALLINT;
  used_participants INT;
  user_offset INT;
  user_email TEXT;
  user_id_value UUID;
  exp_price INT;
  i INT;
  created_ts TIMESTAMPTZ;
BEGIN
  FOR slot_record IN
    SELECT s.id AS slot_id, s.experience_id, s.starts_at, s.capacity, e.price_cop
    FROM public.experience_slots s
    JOIN public.experiences e ON e.id = s.experience_id
    ORDER BY s.experience_id, s.starts_at
  LOOP
    exp_price := slot_record.price_cop;
    used_participants := 0;

    IF slot_record.starts_at < now() - interval '12 hours' THEN
      -- PAST slot
      reservation_count := 2 + (floor(random() * 3))::INT;
      FOR i IN 1..reservation_count LOOP
        participants_value := (1 + floor(random() * 3))::SMALLINT;
        IF used_participants + participants_value > slot_record.capacity - 2 THEN
          EXIT;
        END IF;
        user_offset := ((abs(hashtext(slot_record.slot_id::text || i::text)) % 30) + 1);
        user_email := 'seed_turista_' || lpad(user_offset::text, 3, '0') || '@xitty.local';
        SELECT id INTO user_id_value FROM public.profiles WHERE email = user_email;
        created_ts := slot_record.starts_at - (interval '7 days') - (i * interval '1 hour');
        INSERT INTO public.experience_reservations
          (slot_id, experience_id, user_id, participants, total_price_cop, status, cancelled_at, created_at)
        VALUES
          (slot_record.slot_id, slot_record.experience_id, user_id_value,
           participants_value, exp_price * participants_value,
           'completed', NULL, created_ts);
        used_participants := used_participants + participants_value;
      END LOOP;

    ELSIF slot_record.starts_at < now() + interval '24 hours' THEN
      -- TODAY slot
      reservation_count := 1 + (floor(random() * 2))::INT;
      FOR i IN 1..reservation_count LOOP
        participants_value := (1 + floor(random() * 2))::SMALLINT;
        IF used_participants + participants_value > slot_record.capacity - 2 THEN
          EXIT;
        END IF;
        user_offset := ((abs(hashtext(slot_record.slot_id::text || 'today' || i::text)) % 30) + 1);
        user_email := 'seed_turista_' || lpad(user_offset::text, 3, '0') || '@xitty.local';
        SELECT id INTO user_id_value FROM public.profiles WHERE email = user_email;
        created_ts := now() - interval '3 days' - (i * interval '6 hours');
        INSERT INTO public.experience_reservations
          (slot_id, experience_id, user_id, participants, total_price_cop, status, cancelled_at, created_at)
        VALUES
          (slot_record.slot_id, slot_record.experience_id, user_id_value,
           participants_value, exp_price * participants_value,
           'confirmed', NULL, created_ts);
        used_participants := used_participants + participants_value;
      END LOOP;

    ELSE
      -- FUTURE slot
      reservation_count := 1 + (floor(random() * 3))::INT;
      FOR i IN 1..reservation_count LOOP
        participants_value := (1 + floor(random() * 3))::SMALLINT;
        IF used_participants + participants_value > slot_record.capacity - 2 THEN
          EXIT;
        END IF;
        user_offset := ((abs(hashtext(slot_record.slot_id::text || 'fut' || i::text)) % 30) + 1);
        user_email := 'seed_turista_' || lpad(user_offset::text, 3, '0') || '@xitty.local';
        SELECT id INTO user_id_value FROM public.profiles WHERE email = user_email;
        created_ts := now() - interval '2 days' - (i * interval '5 hours');
        INSERT INTO public.experience_reservations
          (slot_id, experience_id, user_id, participants, total_price_cop, status, cancelled_at, created_at)
        VALUES
          (slot_record.slot_id, slot_record.experience_id, user_id_value,
           participants_value, exp_price * participants_value,
           'confirmed', NULL, created_ts);
        used_participants := used_participants + participants_value;
      END LOOP;

      -- Add an occasional cancelled reservation (~30% of future slots)
      IF random() < 0.30 THEN
        participants_value := (1 + floor(random() * 2))::SMALLINT;
        IF used_participants + participants_value <= slot_record.capacity - 2 THEN
          user_offset := ((abs(hashtext(slot_record.slot_id::text || 'cxl')) % 30) + 1);
          user_email := 'seed_turista_' || lpad(user_offset::text, 3, '0') || '@xitty.local';
          SELECT id INTO user_id_value FROM public.profiles WHERE email = user_email;
          created_ts := now() - interval '10 days';
          INSERT INTO public.experience_reservations
            (slot_id, experience_id, user_id, participants, total_price_cop, status, cancelled_at, created_at)
          VALUES
            (slot_record.slot_id, slot_record.experience_id, user_id_value,
             participants_value, exp_price * participants_value,
             'cancelled', created_ts + interval '2 days', created_ts);
        END IF;
      END IF;
    END IF;
  END LOOP;
END
$exp_reservations$;

-- ----------------------------------------------------------------------------
-- 3.5 Experience reviews (~80 reviews from completed reservations)
-- UNIQUE (experience_id, user_id) — only one review per user per experience
-- ----------------------------------------------------------------------------

DO $exp_reviews$
DECLARE
  res_record RECORD;
  rating_value SMALLINT;
  comment_value TEXT;
  rand_pick FLOAT;
  comments_pos TEXT[] := ARRAY[
    'Excelente experiencia, el guía fue muy amable y profesional. Lo recomiendo totalmente, vale la pena cada peso invertido.',
    'Una de las mejores actividades que hemos hecho en Barranquilla. La organización fue impecable y el ambiente increíble.',
    'Súper recomendado. La atención fue de primera y la experiencia superó mis expectativas. Volveré sin dudarlo.',
    'Maravilloso plan en familia. Los niños quedaron encantados y nosotros aprendimos mucho sobre la cultura local.',
    'Perfecto para conocer la ciudad desde otra perspectiva. El operador es muy puntual y todo salió como lo planeado.',
    'Increíble del principio al fin. La calidad del servicio justifica completamente el precio. Cinco estrellas merecidas.',
    'Nos divertimos muchísimo, el grupo era pequeño y eso permitió una atención personalizada. Recomendado al 100%.',
    'Una experiencia auténtica que muestra lo mejor de la cultura caribe. Salimos felices y con ganas de repetir.',
    'Muy bien organizado todo, llegamos con tiempo y el equipo nos atendió excelente. La experiencia fue espectacular.',
    'Definitivamente uno de los planes imperdibles en Barranquilla. Combina diversión, aprendizaje y buena vibra.',
    'Excelente relación calidad precio. Vinimos con amigos y todos quedamos satisfechos con la actividad.',
    'El guía conoce muchísimo y tiene un carisma especial. Hizo que la experiencia fuera muy entretenida e informativa.'
  ];
  comments_neutral TEXT[] := ARRAY[
    'Buena experiencia en general. Hay aspectos que se pueden mejorar pero cumple con lo prometido.',
    'Estuvo bien aunque esperaba un poco más por el precio. Igualmente la atención del equipo fue buena.',
    'Cumple con lo básico. La actividad es interesante pero la duración se sintió corta para nosotros.',
    'Está bien pero le falta algo extra para ser realmente memorable. El personal es amable eso sí.'
  ];
  comments_neg TEXT[] := ARRAY[
    'No fue lo que esperábamos. La organización pudo haber sido mejor y faltó información previa.',
    'Esperaba más por el precio pagado. Algunas cosas no salieron como estaban prometidas.'
  ];
BEGIN
  -- Loop through completed reservations and add reviews
  FOR res_record IN
    SELECT DISTINCT ON (r.experience_id, r.user_id)
      r.id AS reservation_id, r.experience_id, r.user_id, r.created_at
    FROM public.experience_reservations r
    WHERE r.status = 'completed'
    ORDER BY r.experience_id, r.user_id, r.created_at
  LOOP
    -- Only review about 75% of eligible completed reservations
    IF random() > 0.25 THEN
      rand_pick := random();
      IF rand_pick < 0.55 THEN
        rating_value := 5;
        comment_value := comments_pos[1 + floor(random() * array_length(comments_pos, 1))::INT];
      ELSIF rand_pick < 0.85 THEN
        rating_value := 4;
        comment_value := comments_pos[1 + floor(random() * array_length(comments_pos, 1))::INT];
      ELSIF rand_pick < 0.95 THEN
        rating_value := 3;
        comment_value := comments_neutral[1 + floor(random() * array_length(comments_neutral, 1))::INT];
      ELSE
        rating_value := (1 + floor(random() * 2))::SMALLINT;
        comment_value := comments_neg[1 + floor(random() * array_length(comments_neg, 1))::INT];
      END IF;

      -- ~15% of reviews have no comment
      IF random() < 0.15 THEN
        comment_value := NULL;
      END IF;

      INSERT INTO public.experience_reviews
        (experience_id, reservation_id, user_id, rating, comment, created_at)
      VALUES
        (res_record.experience_id, res_record.reservation_id, res_record.user_id,
         rating_value, comment_value, res_record.created_at + interval '8 days')
      ON CONFLICT (experience_id, user_id) DO NOTHING;
    END IF;
  END LOOP;
END
$exp_reviews$;

-- ----------------------------------------------------------------------------
-- 3.6 Experience review photos (~25% of reviews have 1-3 photos)
-- ----------------------------------------------------------------------------

DO $exp_review_photos$
DECLARE
  review_record RECORD;
  photo_count INT;
  i INT;
  photo_pool TEXT[] := ARRAY[
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80',
    'https://images.unsplash.com/photo-1539635278303-d4002c07eae3?w=1200&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80',
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200&q=80',
    'https://images.unsplash.com/photo-1533577116850-9cc66cad8a9b?w=1200&q=80',
    'https://images.unsplash.com/photo-1577083552431-6e5fd01988ec?w=1200&q=80',
    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1200&q=80',
    'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1200&q=80',
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&q=80',
    'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200&q=80'
  ];
BEGIN
  FOR review_record IN SELECT id FROM public.experience_reviews LOOP
    IF random() < 0.25 THEN
      photo_count := 1 + (floor(random() * 3))::INT;
      FOR i IN 1..photo_count LOOP
        INSERT INTO public.experience_review_photos (review_id, url, display_order)
        VALUES (
          review_record.id,
          photo_pool[1 + ((i + abs(hashtext(review_record.id::text))) % array_length(photo_pool, 1))],
          i - 1
        );
      END LOOP;
    END IF;
  END LOOP;
END
$exp_review_photos$;
-- ============================================================================
-- SECTION 4: Reviews + favorites
-- ============================================================================

-- Reviews: ~600 rows distributed across the 50 seed places from 30 turistas
WITH numbered_places AS (
  SELECT id, row_number() OVER (ORDER BY created_at DESC) AS pn
  FROM public.places
  ORDER BY created_at DESC
  LIMIT 50
),
numbered_users AS (
  SELECT id, row_number() OVER (ORDER BY email) AS un
  FROM public.profiles
  WHERE email LIKE 'seed_turista_%@xitty.local'
),
review_pool AS (
  SELECT
    p.id AS place_id,
    u.id AS user_id,
    p.pn,
    u.un,
    -- Deterministic hash from place_id + user_id
    ('x' || substr(md5(p.id::text || u.id::text), 1, 8))::bit(32)::int AS h
  FROM numbered_places p
  CROSS JOIN numbered_users u
  -- Pick ~40% of combinations (50*30=1500 * 0.4 = 600)
  WHERE ((p.pn * 7 + u.un * 3) % 5) < 2
),
ratings_comments AS (
  SELECT
    place_id,
    user_id,
    -- Rating distribution: ~60% 5, ~25% 4, ~10% 3, ~4% 2, ~1% 1
    CASE
      WHEN (abs(h) % 100) < 60 THEN 5
      WHEN (abs(h) % 100) < 85 THEN 4
      WHEN (abs(h) % 100) < 95 THEN 3
      WHEN (abs(h) % 100) < 99 THEN 2
      ELSE 1
    END AS rating,
    -- ~10% NULL comments
    (abs(h / 100) % 10) = 0 AS null_comment,
    -- Comment index within tier (0-29)
    (abs(h / 1000) % 30) AS comment_idx,
    h
  FROM review_pool
),
comment_pools AS (
  SELECT
    -- 5 star pool (30 comments)
    ARRAY[
      'Excelente lugar, volveremos sin dudarlo. La atención fue inmejorable y el ambiente perfecto.',
      'Una experiencia top en Barranquilla. Comida deliciosa y precios justos.',
      'Increíble desde el primer momento. Cien por ciento recomendado para turistas y locales.',
      'Sin palabras, todo fue perfecto. El personal súper amable y atento en cada detalle.',
      'Lo mejor que he probado en la ciudad. Sabores auténticos y presentación impecable.',
      'Una joya escondida de Barranquilla. La pasamos espectacular en familia.',
      'Definitivamente cinco estrellas. Volveremos pronto con amigos para que lo conozcan.',
      'Calidad excepcional en todo: comida, servicio y ambiente. Lo recomiendo cerrando los ojos.',
      'Mejor imposible. Cada plato fue una sorpresa agradable. Felicitaciones al equipo.',
      'Una experiencia que vale la pena vivir. Atención de primera y precios razonables.',
      'Quedamos encantados. El lugar tiene una vibra única y la atención fue de lujo.',
      'Lo recomiendo al cien por ciento. Calidad, sabor y excelente trato al cliente.',
      'Visita obligada en Barranquilla. No te puedes perder este lugar tan especial.',
      'Todo estuvo espectacular, desde la entrada hasta la salida. Repetiremos seguro.',
      'Una experiencia gastronómica de otro nivel. Cada bocado fue puro placer.',
      'Atención al detalle en todo. Se nota el cariño y profesionalismo del personal.',
      'Volveremos sin pensarlo dos veces. Es de esos lugares que enamoran a la primera.',
      'Perfecto para una salida especial. El ambiente, la música y la comida, todo en armonía.',
      'Superó todas mis expectativas. Recomendado para quienes buscan calidad real.',
      'Increíble experiencia local. La esencia caribeña se siente en cada rincón.',
      'No tengo más que palabras de agradecimiento. Un servicio realmente excepcional.',
      'Calidad-precio insuperable. Cada peso bien invertido en una velada inolvidable.',
      'El mejor sitio que hemos descubierto en este viaje a Barranquilla. Imperdible.',
      'Una atención de cinco estrellas. Se sintieron las ganas de hacer las cosas bien.',
      'Lo tiene todo: ambiente, sabor, servicio y buena energía. Altamente recomendado.',
      'Fue una velada perfecta. Gracias al equipo por hacer que nos sintiéramos en casa.',
      'Repetiría esta experiencia mil veces. Sin duda mi lugar favorito en la ciudad.',
      'Excelente en todos los aspectos. Un orgullo barranquillero tener este tipo de sitios.',
      'Espectacular de principio a fin. La calidad y el detalle se notan en todo.',
      'Una experiencia memorable. Definitivamente uno de los mejores lugares de la costa.'
    ] AS five_star,
    ARRAY[
      'Muy buen sitio aunque un poco demorado el servicio. Vale la pena igual.',
      'Bastante bueno en general. Tal vez un poco lleno los fines de semana, pero ok.',
      'Nos gustó mucho, aunque la espera fue larga. La comida compensó la espera.',
      'Buena experiencia, mejorable en algunos detalles. Pero en general recomendado.',
      'Lugar agradable, atención correcta. Volvería sin problema en otra ocasión.',
      'Cumple muy bien con lo prometido. Algunos detalles podrían mejorar.',
      'Comida rica, servicio aceptable. Buen ambiente para compartir en grupo.',
      'Recomendado, aunque podría mejorar en velocidad del servicio. La calidad está bien.',
      'Disfrutamos la visita. Algunos platos mejores que otros, pero todo correcto.',
      'Buena relación calidad-precio. El ambiente es lo mejor del lugar.',
      'Experiencia positiva en general. Con pequeños ajustes sería un cinco estrellas.',
      'Nos atendieron bien y la comida estuvo buena. Volveremos en otra oportunidad.',
      'Buen lugar para una salida tranquila. La música quizá un poco fuerte.',
      'Casi perfecto, pero algunos detalles en la atención podrían pulirse.',
      'Buena opción si están por la zona. Cumple lo necesario sin grandes sorpresas.',
      'Vale la pena visitarlo. La comida estaba sabrosa aunque las porciones algo justas.',
      'Pasamos un buen rato. El ambiente es lo más destacable del sitio.',
      'Servicio amable y comida correcta. Pequeños retrasos pero nada grave.',
      'Recomiendo el lugar. Algunos platos del menú son realmente muy buenos.',
      'Buena experiencia, mejorable en limpieza de mesas. Lo demás muy bien.',
      'Lo disfrutamos bastante. Tal vez algo costoso para lo que ofrecen, pero rico.',
      'Buen ambiente caribeño, buena comida. Pequeños detalles a mejorar nada más.',
      'Cumple con las expectativas. Cuatro estrellas merecidas por la atención.',
      'Volvería con gusto. La calidad es buena y el trato amable y cercano.',
      'Una visita agradable. La carta tiene muchas opciones interesantes para probar.',
      'Sitio acogedor y comida de buen nivel. Pequeñas mejoras lo llevarían al top.',
      'Pasamos un buen momento. El menú es variado y los precios razonables.',
      'Buen lugar para conocer, especialmente si eres turista. Recomendado.',
      'La pasamos bien. El servicio puede mejorar en horarios pico, pero cumple.',
      'Recomendado para una visita casual. Nada espectacular, pero muy correcto.'
    ] AS four_star,
    ARRAY[
      'Está bien, nada del otro mundo. Funcional para una salida rápida.',
      'Regular, esperaba un poco más por lo que había leído antes de venir.',
      'Promedio. Ni excelente ni malo, simplemente cumple lo básico.',
      'Aceptable, pero hay mejores opciones en la zona. Volvería solo si pasa cerca.',
      'Algunos puntos buenos y otros mejorables. Experiencia bastante neutra.',
      'No es lo mejor que he probado, pero tampoco lo peor. Está ok.',
      'Servicio lento y comida promedio. Quizá tuvimos un día malo, no sé.',
      'Cumple con lo básico, no hay mucho más que destacar. Precios algo altos.',
      'Tiene potencial pero le faltan varios detalles para destacarse de verdad.',
      'Comida correcta, ambiente bueno, servicio justo. Una experiencia tres estrellas.',
      'No me sorprendió ni para bien ni para mal. Una opción más en la ciudad.',
      'Algunos platos buenos, otros flojos. Falta consistencia en la cocina.',
      'Está bien para ir una vez y conocer. No siento muchas ganas de repetir.',
      'Ambiente lindo pero la comida no acompañó. Esperaba mejor calidad.',
      'Servicio amable pero los tiempos de espera son demasiado largos.',
      'Promedio en todo. No hay nada que recordar especialmente del lugar.',
      'Esperaba más por los comentarios. La realidad fue más bien tibia.',
      'Funcional para resolver, no para una experiencia memorable. Cumple básico.',
      'Algunos errores en el pedido y atención distraída. Comida pasable.',
      'Está ok, pero por el precio uno espera un poco más de detalle.',
      'Visita correcta, sin más. No me motiva a recomendarlo activamente.',
      'Bueno-regular. Le falta personalidad para destacarse en el mar de opciones.',
      'Cumple, pero no enamora. Es de esos sitios que se olvidan rápido.',
      'Atención fría y comida estándar. Tres estrellas por el ambiente nada más.',
      'Hay días buenos y días malos por lo que vi. Yo fui en un día regular.',
      'No es malo, pero le falta ese algo extra que lo haga sobresalir.',
      'Pasa, sin ser nada del otro mundo. Hay sitios mejores por el mismo precio.',
      'Regular. La comida estuvo bien pero el servicio no estuvo a la altura.',
      'Lugar normal, ni espectacular ni decepcionante. Punto medio en todo.',
      'Aceptable para salir del paso. Para algo especial buscaría otra opción.'
    ] AS three_star,
    ARRAY[
      'Esperaba más por las recomendaciones que me dieron.',
      'No me gustó mucho. La comida estaba fría cuando llegó a la mesa.',
      'Servicio muy lento y atención poco amable. No volvería pronto.',
      'Decepcionante en general. Por lo que se paga hay opciones mucho mejores.',
      'Mucho ruido y poco confort. La comida tampoco estuvo a la altura.',
      'Tuvieron varios errores con nuestro pedido. La atención no fue buena.',
      'Calidad muy por debajo de lo esperado. No lo recomendaría a nadie.',
      'La presentación de los platos es muy descuidada. Sabor pasable.',
      'Atención fría y poco profesional. La experiencia no fue buena.',
      'Demasiado lleno y poco organizados. Esperamos mucho para que nos atendieran.',
      'No volveré. Hay muchas mejores opciones por la zona a precios similares.',
      'La cuenta llegó con varios errores. La atención dejó mucho que desear.',
      'Comida insípida y ambiente sobrecargado. No recomendado.',
      'Esperábamos una experiencia agradable y nos quedamos con sabor a poco.',
      'Mala relación calidad-precio. Por lo que se paga uno espera mucho más.',
      'Servicio improvisado y desorganizado. Necesitan mejorar bastante.',
      'No cumplió con las expectativas. Mejor explorar otras alternativas cercanas.',
      'Comida fría, mesas sucias y servicio distraído. Mala experiencia general.',
      'Quedé con sensación de haber perdido tiempo y dinero. No volvería.',
      'El ambiente está bien, pero la comida y el servicio fallaron bastante.',
      'No vale lo que cobran. La calidad ha bajado mucho según vi.',
      'Tuvimos que esperar demasiado para todo. La comida no compensó la espera.',
      'Trato poco amable del personal. No te hacen sentir bienvenido en el sitio.',
      'Decepción grande. Esperaba algo mucho mejor para una salida especial.',
      'Necesitan capacitar al personal urgentemente. La atención fue muy floja.',
      'Comida sin sabor y atención lenta. Una combinación que no funciona.',
      'No lo recomendaría. Hay demasiadas fallas para el precio que cobran.',
      'Lugar desorganizado y servicio errático. Difícil disfrutar la visita.',
      'Pésima atención en la barra. La comida tampoco estuvo a la altura.',
      'Una experiencia para olvidar. No corresponde con lo que prometen.'
    ] AS two_star,
    ARRAY[
      'Mala experiencia, no volvería. El servicio dejó mucho que desear.',
      'Pésimo en todos los aspectos. La peor visita que hemos tenido en años.',
      'Terrible atención y comida en mal estado. No lo recomiendo a nadie.',
      'Una completa decepción. Perdimos tiempo y dinero en este lugar.',
      'No vayan, créanme. Hay miles de opciones mejores en Barranquilla.',
      'Servicio inexistente y comida intomable. Lo peor de lo peor.',
      'Salimos del lugar muy molestos. Trato grosero y cuenta inflada.',
      'Una pesadilla de visita. No regresaremos jamás a ese sitio.',
      'Pésima higiene visible y atención de mala gana. Evitar a toda costa.',
      'Trato grosero por parte del personal. Cobran de más y discuten con el cliente.',
      'Todo mal: comida, servicio, ambiente. No hay nada que rescatar.',
      'Una de las peores experiencias gastronómicas de mi vida. Lamentable.',
      'No vuelvo ni regalado. Mala atención y comida que no se puede comer.',
      'Decepción total. El sitio no debería estar abierto con esta calidad.',
      'Pésimo lugar. Salimos sin terminar y con mala sensación general.',
      'Una falta de respeto total al cliente. Pésima atención y pésima comida.',
      'No recomiendo este sitio a nadie. Solo trae malos ratos y problemas.',
      'Vergonzoso el nivel del servicio. Como turista me sentí estafado.',
      'Comida en mal estado y atención abusiva. Una experiencia para olvidar.',
      'Pésima experiencia de principio a fin. Eviten este lugar a toda costa.',
      'Mala administración a todos los niveles. Necesitan reinventarse o cerrar.',
      'Servicio caótico y trato deplorable. No sé cómo siguen abiertos.',
      'Todo salió mal. Pedido equivocado, comida fría, cuenta abusiva. Pésimo.',
      'Una verdadera decepción. Le hace mal a la imagen de Barranquilla.',
      'No vuelvo más. La experiencia fue de las peores que recuerdo.',
      'Pésimo, pésimo, pésimo. No alcanzan las palabras para describir lo mal que la pasamos.',
      'Trato discriminatorio y comida intomable. Una vergüenza el sitio.',
      'Salimos enojados y con la promesa de no volver jamás. Pésima atención.',
      'Un desastre completo. Por favor, no pierdan su tiempo ni su dinero aquí.',
      'Lo peor que probé en Barranquilla. Una mancha en la oferta gastronómica local.'
    ] AS one_star
)
INSERT INTO public.reviews (place_id, user_id, rating, comment, created_at)
SELECT
  rc.place_id,
  rc.user_id,
  rc.rating,
  CASE
    WHEN rc.null_comment THEN NULL
    WHEN rc.rating = 5 THEN cp.five_star[rc.comment_idx + 1]
    WHEN rc.rating = 4 THEN cp.four_star[rc.comment_idx + 1]
    WHEN rc.rating = 3 THEN cp.three_star[rc.comment_idx + 1]
    WHEN rc.rating = 2 THEN cp.two_star[rc.comment_idx + 1]
    ELSE cp.one_star[rc.comment_idx + 1]
  END AS comment,
  now() - (random() * interval '180 days') AS created_at
FROM ratings_comments rc
CROSS JOIN comment_pools cp
ON CONFLICT (place_id, user_id) DO NOTHING;

-- Favorites: ~400 rows (each turista marks 10-15 random places)
INSERT INTO public.favorites (user_id, place_id, created_at)
SELECT
  u.id AS user_id,
  p.id AS place_id,
  now() - (random() * interval '90 days') AS created_at
FROM (
  SELECT id FROM public.profiles WHERE email LIKE 'seed_turista_%@xitty.local'
) u
CROSS JOIN LATERAL (
  SELECT id
  FROM public.places
  ORDER BY random()
  LIMIT (10 + (random() * 5)::int)
) p
ON CONFLICT (user_id, place_id) DO NOTHING;
-- ============================================================================
-- SECTION 5: Promotions + featured_content + local_picks
-- ============================================================================
-- NOTE: These tables have no natural UNIQUE constraint besides PK.
-- Re-running this script WILL create duplicate rows. Truncate before re-seeding if needed.

-- ----------------------------------------------------------------------------
-- PROMOTIONS (~60 rows: 25 active + 15 scheduled + 20 expired)
-- ----------------------------------------------------------------------------

-- 25 ACTIVE promotions
WITH picked_places AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY random()) AS rn
  FROM public.places
  ORDER BY random()
  LIMIT 25
),
title_pool AS (
  SELECT ARRAY[
    '2x1 en cócteles después de las 8pm',
    '30% off en mariscos los martes',
    'Happy hour 5-7pm',
    'Promoción aniversario 25% en toda la carta',
    'Cena con vista al mar + copa de vino gratis',
    'Niños comen gratis los domingos',
    'Tour guiado con 40% de descuento',
    'Hospedaje de 3 noches con desayuno incluido',
    'Entrada 2x1 los miércoles',
    'Sesión de masaje + sauna con 20% off'
  ] AS titles,
  ARRAY[
    'Disfruta dos cócteles por el precio de uno todas las noches después de las 8pm. Aplica de lunes a jueves, no acumulable con otras promociones.',
    'Los martes ofrecemos 30% de descuento en todos los platos de mariscos frescos del Caribe. Válido para consumo en el local.',
    'Happy hour todos los días de 5 a 7pm con cervezas, vinos por copa y picadas a precio especial. Imperdible después del trabajo.',
    'Celebramos nuestro aniversario con 25% de descuento en toda la carta durante una semana. Reservas recomendadas.',
    'Cena romántica con vista al mar e incluimos una copa de vino tinto o blanco por persona. Válido de domingo a jueves.',
    'Los domingos los niños menores de 10 años comen gratis acompañados de un adulto con plato principal. Máximo dos niños por adulto.',
    'Tour guiado por los puntos históricos con 40% de descuento. Cupo limitado, reserva con anticipación.',
    'Paquete de 3 noches con desayuno buffet incluido y late checkout. Válido para reservas directas.',
    'Entrada general 2x1 todos los miércoles. Aplica solo para taquilla, no para eventos especiales.',
    'Masaje relajante de 60 minutos más acceso al sauna con 20% de descuento. Cita previa requerida.'
  ] AS descriptions,
  ARRAY[15, 20, 25, 30, 40, 50, 10]::smallint[] AS discounts
)
INSERT INTO public.promotions (place_id, title, description, discount_percentage, starts_at, ends_at, is_active)
SELECT
  pp.id,
  tp.titles[((pp.rn - 1) % 10) + 1],
  tp.descriptions[((pp.rn - 1) % 10) + 1],
  tp.discounts[((pp.rn - 1) % 7) + 1],
  now() - ((pp.rn % 14 + 1) || ' days')::interval,
  now() + ((pp.rn % 21 + 10) || ' days')::interval,
  true
FROM picked_places pp, title_pool tp;

-- 15 SCHEDULED promotions (future)
WITH picked_places AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY random()) AS rn
  FROM public.places
  ORDER BY random()
  LIMIT 15
),
title_pool AS (
  SELECT ARRAY[
    'Pre-venta: cena de fin de año 30% off',
    'Carnaval 2026: paquete especial 25% descuento',
    'Apertura nueva sucursal: 50% en primera semana',
    'San Valentín: cena para dos con champagne',
    'Semana Santa: tour con guía certificado',
    'Festival gastronómico: menú degustación 20% off',
    'Black Friday hospedaje 40% descuento',
    'Aniversario ciudad: entrada gratis a museos',
    'Verano: combo familiar con descuento',
    'Reapertura terraza: cócteles 2x1 una semana'
  ] AS titles,
  ARRAY[
    'Pre-venta para cena de fin de año con 30% de descuento. Cupos limitados, reserva con anticipación.',
    'Paquete especial para temporada de carnaval con 25% de descuento en todos los servicios. Válido del 6 al 9 de febrero.',
    'Apertura de nueva sucursal con 50% de descuento durante la primera semana. Aplica solo en el nuevo local.',
    'Cena romántica para dos con copa de champagne incluida. Reservas exclusivas para la noche del 14 de febrero.',
    'Tour especial de Semana Santa con guía certificado y refrigerio incluido. Cupo de 20 personas por día.',
    'Festival gastronómico con menú degustación de 5 tiempos al 20% de descuento. Duración una semana.',
    'Promoción Black Friday en hospedaje con 40% de descuento sobre tarifa rack. Reservas online únicamente.',
    'Celebración del aniversario de la ciudad con entrada gratuita a museos por un día. Inscripción previa.',
    'Combo familiar de verano con descuento especial para familias de 4 personas. Incluye almuerzo y bebidas.',
    'Reapertura de terraza con cócteles 2x1 durante toda la primera semana. Imperdible para foodies.'
  ] AS descriptions,
  ARRAY[15, 20, 25, 30, 40, 50, 10]::smallint[] AS discounts
)
INSERT INTO public.promotions (place_id, title, description, discount_percentage, starts_at, ends_at, is_active)
SELECT
  pp.id,
  tp.titles[((pp.rn - 1) % 10) + 1],
  tp.descriptions[((pp.rn - 1) % 10) + 1],
  tp.discounts[((pp.rn - 1) % 7) + 1],
  now() + ((pp.rn % 30 + 5) || ' days')::interval,
  now() + ((pp.rn % 30 + 5) || ' days')::interval + ((pp.rn % 14 + 7) || ' days')::interval,
  true
FROM picked_places pp, title_pool tp;

-- 20 EXPIRED promotions
WITH picked_places AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY random()) AS rn
  FROM public.places
  ORDER BY random()
  LIMIT 20
),
title_pool AS (
  SELECT ARRAY[
    '2x1 en cócteles después de las 8pm',
    '30% off en mariscos los martes',
    'Happy hour 5-7pm',
    'Promoción aniversario 25% en toda la carta',
    'Cena con vista al mar + copa de vino gratis',
    'Niños comen gratis los domingos',
    'Tour guiado con 40% de descuento',
    'Hospedaje de 3 noches con desayuno incluido',
    'Entrada 2x1 los miércoles',
    'Sesión de masaje + sauna con 20% off'
  ] AS titles,
  ARRAY[
    'Promoción finalizada de 2x1 en cócteles después de las 8pm.',
    'Promoción finalizada de 30% off en mariscos los martes.',
    'Happy hour de temporada pasada con cervezas y picadas.',
    'Aniversario celebrado con 25% en toda la carta.',
    'Cena especial con copa de vino que ya finalizó.',
    'Promoción para niños que comieron gratis los domingos del mes pasado.',
    'Tour guiado con descuento especial ya finalizado.',
    'Paquete de hospedaje de temporada pasada ya finalizado.',
    'Promoción de entrada 2x1 los miércoles del mes pasado.',
    'Sesión de masaje con descuento que ya terminó.'
  ] AS descriptions,
  ARRAY[15, 20, 25, 30, 40, 50, 10]::smallint[] AS discounts
)
INSERT INTO public.promotions (place_id, title, description, discount_percentage, starts_at, ends_at, is_active)
SELECT
  pp.id,
  tp.titles[((pp.rn - 1) % 10) + 1],
  tp.descriptions[((pp.rn - 1) % 10) + 1],
  tp.discounts[((pp.rn - 1) % 7) + 1],
  now() - ((pp.rn % 60 + 30) || ' days')::interval,
  now() - ((pp.rn % 20 + 5) || ' days')::interval,
  false
FROM picked_places pp, title_pool tp;

-- ----------------------------------------------------------------------------
-- FEATURED CONTENT (12 rows)
-- ----------------------------------------------------------------------------

-- 4 CURRENT week
WITH picked_places AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY random()) - 1) AS rn
  FROM public.places
  ORDER BY random()
  LIMIT 4
),
admins AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY email) - 1) AS rn
  FROM public.profiles
  WHERE email IN ('seed_admin_001@xitty.local', 'seed_admin_002@xitty.local')
),
pool AS (
  SELECT
    ARRAY['Equipo Xitty','María Curadora','Andrés Editorial','Camila Picks','Editorial Xitty'] AS curators,
    ARRAY[
      'El plan que no te puedes perder este finde',
      'Joya escondida del Caribe',
      'Imprescindible esta semana',
      'El nuevo hot spot de Barranquilla'
    ] AS titles,
    ARRAY[
      'Una experiencia que reúne lo mejor de la gastronomía local con un ambiente único. Recomendado por nuestro equipo editorial para vivir este fin de semana.',
      'Descubre este rincón escondido que enamora a quienes lo visitan. Una joya que combina tradición, sabor y autenticidad caribeña.',
      'Este lugar se ha convertido en parada obligatoria para locales y visitantes. No te lo puedes perder esta semana.',
      'El nuevo hot spot de la ciudad combina diseño, sabor y buena música. Ideal para una salida diferente.'
    ] AS descriptions,
    ARRAY[
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80',
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80',
      'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1200&q=80',
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80'
    ] AS images
)
INSERT INTO public.featured_content (place_id, curator_name, custom_title, custom_description, hero_image_url, week_starts_at, week_ends_at, position, is_active, created_by)
SELECT
  pp.id,
  p.curators[(pp.rn % 5) + 1],
  p.titles[pp.rn::int + 1],
  p.descriptions[pp.rn::int + 1],
  p.images[pp.rn::int + 1],
  date_trunc('week', now()),
  date_trunc('week', now()) + interval '7 days',
  pp.rn::smallint,
  true,
  (SELECT id FROM admins WHERE rn = (pp.rn % 2))
FROM picked_places pp, pool p;

-- 4 LAST WEEK
WITH picked_places AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY random()) - 1) AS rn
  FROM public.places
  ORDER BY random()
  LIMIT 4
),
admins AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY email) - 1) AS rn
  FROM public.profiles
  WHERE email IN ('seed_admin_001@xitty.local', 'seed_admin_002@xitty.local')
),
pool AS (
  SELECT
    ARRAY['Equipo Xitty','María Curadora','Andrés Editorial','Camila Picks','Editorial Xitty'] AS curators,
    ARRAY[
      'Destacado de la semana pasada',
      'El sitio más visitado del mes',
      'Recomendado por nuestros editores',
      'Top pick de la curaduría Xitty'
    ] AS titles,
    ARRAY[
      'Lugar que destacamos la semana pasada por su propuesta única y la calidad de su servicio. Sigue siendo un must.',
      'Uno de los sitios más visitados del mes según nuestras métricas. La comunidad lo valida con sus visitas.',
      'Recomendación editorial por la consistencia y autenticidad de la experiencia. Vale la pena conocerlo.',
      'Top pick de nuestra curaduría por combinar precio, sabor y ambiente. Recomendado sin reservas.'
    ] AS descriptions,
    ARRAY[
      'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=1200&q=80',
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80',
      'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=1200&q=80',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1200&q=80'
    ] AS images
)
INSERT INTO public.featured_content (place_id, curator_name, custom_title, custom_description, hero_image_url, week_starts_at, week_ends_at, position, is_active, created_by)
SELECT
  pp.id,
  p.curators[(pp.rn % 5) + 1],
  p.titles[pp.rn::int + 1],
  p.descriptions[pp.rn::int + 1],
  p.images[pp.rn::int + 1],
  date_trunc('week', now() - interval '7 days'),
  date_trunc('week', now() - interval '7 days') + interval '7 days',
  pp.rn::smallint,
  true,
  (SELECT id FROM admins WHERE rn = (pp.rn % 2))
FROM picked_places pp, pool p;

-- 4 TWO WEEKS AGO
WITH picked_places AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY random()) - 1) AS rn
  FROM public.places
  ORDER BY random()
  LIMIT 4
),
admins AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY email) - 1) AS rn
  FROM public.profiles
  WHERE email IN ('seed_admin_001@xitty.local', 'seed_admin_002@xitty.local')
),
pool AS (
  SELECT
    ARRAY['Equipo Xitty','María Curadora','Andrés Editorial','Camila Picks','Editorial Xitty'] AS curators,
    ARRAY[
      'Clásico recomendado por Xitty',
      'Sitio favorito de los curadores',
      'Historia y sabor en un solo lugar',
      'Imperdible de Barranquilla'
    ] AS titles,
    ARRAY[
      'Un clásico que nuestra curaduría recomienda visitar al menos una vez. Tradición y calidad garantizadas.',
      'Sitio favorito de nuestros curadores por su ambiente acogedor y atención personalizada. Para repetir.',
      'Lugar donde la historia y el sabor se encuentran. Una experiencia que vale la pena vivir en Barranquilla.',
      'Imperdible para quienes visitan la ciudad o llevan tiempo aquí. Recomendado por el equipo Xitty.'
    ] AS descriptions,
    ARRAY[
      'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=1200&q=80',
      'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&q=80',
      'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1200&q=80',
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80'
    ] AS images
)
INSERT INTO public.featured_content (place_id, curator_name, custom_title, custom_description, hero_image_url, week_starts_at, week_ends_at, position, is_active, created_by)
SELECT
  pp.id,
  p.curators[(pp.rn % 5) + 1],
  p.titles[pp.rn::int + 1],
  p.descriptions[pp.rn::int + 1],
  p.images[pp.rn::int + 1],
  date_trunc('week', now() - interval '14 days'),
  date_trunc('week', now() - interval '14 days') + interval '7 days',
  pp.rn::smallint,
  true,
  (SELECT id FROM admins WHERE rn = (pp.rn % 2))
FROM picked_places pp, pool p;

-- ----------------------------------------------------------------------------
-- LOCAL PICKS (12 rows)
-- ----------------------------------------------------------------------------

-- 4 CURRENT week: 2 favorito_local, 1 secreto, 1 autentico
WITH picked_places AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY random()) - 1) AS rn
  FROM public.places
  ORDER BY random()
  LIMIT 4
),
admins AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY email) - 1) AS rn
  FROM public.profiles
  WHERE email IN ('seed_admin_001@xitty.local', 'seed_admin_002@xitty.local')
),
pool AS (
  SELECT
    ARRAY['Andrea Local','Carlos Conoce','Mariana del Norte','Diego Caribe','Sofía Centro'] AS curators,
    ARRAY['favorito_local','favorito_local','secreto','autentico'] AS tags,
    ARRAY[
      'Si quieres comer como un barranquillero de verdad, este es el sitio. La gente del barrio lo defiende con la vida.',
      'Mi favorito desde siempre. Sirven porciones generosas y el sabor es de casa. Imposible no volver.',
      'Pocas personas lo conocen pero quienes han ido repiten. Un secreto bien guardado de la ciudad.',
      'Auténtico en cada detalle. Si buscas la receta de verdad, sin atajos ni concesiones turísticas, este es el lugar.'
    ] AS pitches,
    ARRAY[
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80',
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80',
      'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1200&q=80',
      'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=1200&q=80'
    ] AS images
)
INSERT INTO public.local_picks (place_id, curator_name, pick_tag, short_pitch, hero_image_url, week_starts_at, week_ends_at, position, is_active, created_by)
SELECT
  pp.id,
  p.curators[(pp.rn % 5) + 1],
  p.tags[pp.rn::int + 1],
  p.pitches[pp.rn::int + 1],
  p.images[pp.rn::int + 1],
  date_trunc('week', now()),
  date_trunc('week', now()) + interval '7 days',
  pp.rn::smallint,
  true,
  (SELECT id FROM admins WHERE rn = (pp.rn % 2))
FROM picked_places pp, pool p;

-- 4 LAST WEEK
WITH picked_places AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY random()) - 1) AS rn
  FROM public.places
  ORDER BY random()
  LIMIT 4
),
admins AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY email) - 1) AS rn
  FROM public.profiles
  WHERE email IN ('seed_admin_001@xitty.local', 'seed_admin_002@xitty.local')
),
pool AS (
  SELECT
    ARRAY['Andrea Local','Carlos Conoce','Mariana del Norte','Diego Caribe','Sofia Centro'] AS curators,
    ARRAY['favorito_local','favorito_local','secreto','autentico'] AS tags,
    ARRAY[
      'Lo recomiendo con los ojos cerrados. Llevo anos visitandolo y nunca decepciona. Sabor barranquillero puro.',
      'De los favoritos del barrio. Siempre lleno de locales y casi sin turistas. Eso ya dice mucho.',
      'Un secreto que solo los del centro conocemos. No esta en las guias pero deberia. Comida honesta y precio justo.',
      'Aqui se cocina como manda la tradicion costena. Sin filtros, sin show, solo sabor autentico.'
    ] AS pitches,
    ARRAY[
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1200&q=80',
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80',
      'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=1200&q=80'
    ] AS images
)
INSERT INTO public.local_picks (place_id, curator_name, pick_tag, short_pitch, hero_image_url, week_starts_at, week_ends_at, position, is_active, created_by)
SELECT
  pp.id,
  p.curators[(pp.rn % 5) + 1],
  p.tags[pp.rn::int + 1],
  p.pitches[pp.rn::int + 1],
  p.images[pp.rn::int + 1],
  date_trunc('week', now() - interval '7 days'),
  date_trunc('week', now() - interval '7 days') + interval '7 days',
  pp.rn::smallint,
  true,
  (SELECT id FROM admins WHERE rn = (pp.rn % 2))
FROM picked_places pp, pool p;

-- 4 TWO WEEKS AGO
WITH picked_places AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY random()) - 1) AS rn
  FROM public.places
  ORDER BY random()
  LIMIT 4
),
admins AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY email) - 1) AS rn
  FROM public.profiles
  WHERE email IN ('seed_admin_001@xitty.local', 'seed_admin_002@xitty.local')
),
pool AS (
  SELECT
    ARRAY['Andrea Local','Carlos Conoce','Mariana del Norte','Diego Caribe','Sofia Centro'] AS curators,
    ARRAY['favorito_local','favorito_local','secreto','autentico'] AS tags,
    ARRAY[
      'El sitio donde llevo a mis amigos cuando vienen a visitarme. Nunca falla y siempre quedan encantados.',
      'Mi parche desde hace anos. Sabor de casa, precios honestos y trato familiar. Mi recomendacion.',
      'Pocos lo conocen y casi mejor asi. Pero si te lo dijera un amigo, te diria que vayas sin dudar.',
      'Receta de la abuela en cada plato. Aqui no hay atajos, todo se hace como manda la tradicion.'
    ] AS pitches,
    ARRAY[
      'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=1200&q=80',
      'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&q=80',
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80',
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80'
    ] AS images
)
INSERT INTO public.local_picks (place_id, curator_name, pick_tag, short_pitch, hero_image_url, week_starts_at, week_ends_at, position, is_active, created_by)
SELECT
  pp.id,
  p.curators[(pp.rn % 5) + 1],
  p.tags[pp.rn::int + 1],
  p.pitches[pp.rn::int + 1],
  p.images[pp.rn::int + 1],
  date_trunc('week', now() - interval '14 days'),
  date_trunc('week', now() - interval '14 days') + interval '7 days',
  pp.rn::smallint,
  true,
  (SELECT id FROM admins WHERE rn = (pp.rn % 2))
FROM picked_places pp, pool p;
-- ============================================================================
-- SECTION 6: microsite_interactions (90 days of analytics events)
-- ============================================================================

-- Build a weighted pool of places (operator places weighted 5x) and insert
-- ~5000 interaction events with realistic distribution across the past 90 days.
INSERT INTO public.microsite_interactions (place_id, user_id, interaction_type, promo_id, created_at)
SELECT
  -- Place selection: operator places (with owner_id) get 5x weight vs others.
  (
    SELECT id FROM (
      SELECT id FROM public.places WHERE owner_id IS NOT NULL
      UNION ALL SELECT id FROM public.places WHERE owner_id IS NOT NULL
      UNION ALL SELECT id FROM public.places WHERE owner_id IS NOT NULL
      UNION ALL SELECT id FROM public.places WHERE owner_id IS NOT NULL
      UNION ALL SELECT id FROM public.places WHERE owner_id IS NOT NULL
      UNION ALL SELECT id FROM public.places
    ) sub
    ORDER BY random()
    LIMIT 1
  ) AS place_id,
  -- 30% authenticated turista, 70% anonymous (NULL).
  CASE
    WHEN random() < 0.30 THEN (
      SELECT id FROM public.profiles
      WHERE email LIKE 'seed_turista_%@xitty.local'
      ORDER BY random()
      LIMIT 1
    )
    ELSE NULL
  END AS user_id,
  -- Funnel-weighted interaction type.
  CASE
    WHEN r < 0.60 THEN 'profile_view'
    WHEN r < 0.72 THEN 'directions_click'
    WHEN r < 0.82 THEN 'call_click'
    WHEN r < 0.92 THEN 'whatsapp_click'
    WHEN r < 0.97 THEN 'reservation_click'
    ELSE 'promo_view'
  END AS interaction_type,
  -- promo_id filled in a second pass below (only for promo_view rows).
  NULL::uuid AS promo_id,
  -- Time distribution: 60% in last 30d, 30% in 31-60d, 10% in 61-90d,
  -- with peak-hour bias toward lunch (12-14) and dinner/night (18-22)
  -- ~70% of the time, off-peak (0-7) only ~5%.
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
        -- 35% lunch peak (12-14)
        WHEN r3 < 0.35 THEN (12 + floor(random() * 3))::int * interval '1 hour'
        -- 35% dinner/night peak (18-22)
        WHEN r3 < 0.70 THEN (18 + floor(random() * 5))::int * interval '1 hour'
        -- 5% early morning (0-7) - sparse
        WHEN r3 < 0.75 THEN floor(random() * 8)::int * interval '1 hour'
        -- 25% rest of day (8-11, 15-17, 23)
        ELSE (
          CASE floor(random() * 8)::int
            WHEN 0 THEN 8  WHEN 1 THEN 9  WHEN 2 THEN 10 WHEN 3 THEN 11
            WHEN 4 THEN 15 WHEN 5 THEN 16 WHEN 6 THEN 17 ELSE 23
          END
        ) * interval '1 hour'
      END
    )
    + floor(random() * 60)::int * interval '1 minute'
    + floor(random() * 60)::int * interval '1 second'
  ) AS created_at
FROM (
  SELECT
    n,
    random() AS r,
    random() AS r2,
    random() AS r3
  FROM generate_series(1, 5000) AS gs(n)
) src;

-- Weekend boost: shift ~18% of weekday rows to the following weekend
-- so Fri-Sun ends up ~50% busier than weekdays.
UPDATE public.microsite_interactions
SET created_at = created_at + ((5 - EXTRACT(DOW FROM created_at)::int) % 7 + floor(random() * 3)::int) * interval '1 day'
WHERE id IN (
  SELECT id FROM public.microsite_interactions
  WHERE EXTRACT(DOW FROM created_at) BETWEEN 1 AND 4
    AND random() < 0.18
);

-- Fill promo_id for promo_view interactions where the place has an active promo.
UPDATE public.microsite_interactions mi
SET promo_id = (
  SELECT p.id
  FROM public.promotions p
  WHERE p.place_id = mi.place_id
    AND p.is_active = true
  ORDER BY random()
  LIMIT 1
)
WHERE mi.interaction_type = 'promo_view'
  AND mi.promo_id IS NULL;
-- ============================================================================
-- SECTION 7: Recalcular agregados + refrescar ranking
-- ============================================================================
-- Los triggers ya actualizan average_rating y total_reviews en cada insert,
-- pero por si acaso (o si llegas aquí con datos previos), forzamos un recalc.

-- Recalcular places.average_rating y places.total_reviews
UPDATE public.places p
SET
  average_rating = COALESCE(sub.avg, 0),
  total_reviews  = COALESCE(sub.cnt, 0)
FROM (
  SELECT place_id, ROUND(AVG(rating)::numeric, 1) AS avg, COUNT(*) AS cnt
  FROM public.reviews
  GROUP BY place_id
) sub
WHERE p.id = sub.place_id;

-- Recalcular experiences.average_rating y experiences.total_reviews
UPDATE public.experiences e
SET
  average_rating = COALESCE(sub.avg, 0),
  total_reviews  = COALESCE(sub.cnt, 0)
FROM (
  SELECT experience_id, ROUND(AVG(rating)::numeric, 1) AS avg, COUNT(*) AS cnt
  FROM public.experience_reviews
  GROUP BY experience_id
) sub
WHERE e.id = sub.experience_id;

-- Refrescar materialized view del ranking (depende de la nueva data)
SELECT public.refresh_place_rankings();

-- ============================================================================
-- HERO ADS — marca 5 promos como hero para el slot #1 del home
-- ============================================================================
-- Defensive: only runs if the hero columns exist (added by the
-- 20260617000002_extend_promotions_for_hero migration). Older snapshots
-- of this seed file can still be loaded without error.

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
-- ✅ SEED COMPLETO
-- ============================================================================
-- Para verificar, corre:
--   SELECT 'profiles' tabla, count(*) FROM public.profiles WHERE email LIKE 'seed_%@xitty.local'
--   UNION ALL SELECT 'places',           count(*) FROM public.places
--   UNION ALL SELECT 'place_photos',     count(*) FROM public.place_photos
--   UNION ALL SELECT 'reviews',          count(*) FROM public.reviews
--   UNION ALL SELECT 'favorites',        count(*) FROM public.favorites
--   UNION ALL SELECT 'experiences',      count(*) FROM public.experiences
--   UNION ALL SELECT 'exp_slots',        count(*) FROM public.experience_slots
--   UNION ALL SELECT 'exp_reservations', count(*) FROM public.experience_reservations
--   UNION ALL SELECT 'exp_reviews',      count(*) FROM public.experience_reviews
--   UNION ALL SELECT 'promotions',       count(*) FROM public.promotions
--   UNION ALL SELECT 'featured_content', count(*) FROM public.featured_content
--   UNION ALL SELECT 'local_picks',      count(*) FROM public.local_picks
--   UNION ALL SELECT 'interactions',     count(*) FROM public.microsite_interactions
--   UNION ALL SELECT 'sponsored',        count(*) FROM public.places WHERE is_sponsored = true;
-- ============================================================================

-- ============================================================================
-- 🧹 CLEANUP (opcional, comentado) — para resetear el seed
-- ============================================================================
-- Si quieres limpiar TODO este seed antes de re-ejecutar, descomenta:
--
-- BEGIN;
-- DELETE FROM public.microsite_interactions WHERE place_id IN (SELECT id FROM public.places WHERE created_at > now() - interval '1 day');
-- DELETE FROM public.local_picks WHERE created_at > now() - interval '1 day';
-- DELETE FROM public.featured_content WHERE created_at > now() - interval '1 day';
-- DELETE FROM public.promotions WHERE created_at > now() - interval '1 day';
-- DELETE FROM public.experience_review_photos WHERE review_id IN (SELECT id FROM public.experience_reviews WHERE user_id IN (SELECT id FROM public.profiles WHERE email LIKE 'seed_%@xitty.local'));
-- DELETE FROM public.experience_reviews WHERE user_id IN (SELECT id FROM public.profiles WHERE email LIKE 'seed_%@xitty.local');
-- DELETE FROM public.experience_reservations WHERE user_id IN (SELECT id FROM public.profiles WHERE email LIKE 'seed_%@xitty.local');
-- DELETE FROM public.experience_slots WHERE experience_id IN (SELECT id FROM public.experiences WHERE created_at > now() - interval '1 day');
-- DELETE FROM public.experience_photos WHERE experience_id IN (SELECT id FROM public.experiences WHERE created_at > now() - interval '1 day');
-- DELETE FROM public.experiences WHERE created_at > now() - interval '1 day';
-- DELETE FROM public.favorites WHERE user_id IN (SELECT id FROM public.profiles WHERE email LIKE 'seed_%@xitty.local');
-- DELETE FROM public.reviews WHERE user_id IN (SELECT id FROM public.profiles WHERE email LIKE 'seed_%@xitty.local');
-- DELETE FROM public.place_photos WHERE place_id IN (SELECT id FROM public.places WHERE created_at > now() - interval '1 day');
-- DELETE FROM public.places WHERE created_at > now() - interval '1 day';
-- DELETE FROM public.business_notification_settings WHERE user_id IN (SELECT id FROM public.profiles WHERE email LIKE 'seed_%@xitty.local');
-- DELETE FROM public.user_preferences WHERE user_id IN (SELECT id FROM public.profiles WHERE email LIKE 'seed_%@xitty.local');
-- DELETE FROM public.user_roles WHERE user_id IN (SELECT id FROM public.profiles WHERE email LIKE 'seed_%@xitty.local');
-- DELETE FROM public.profiles WHERE email LIKE 'seed_%@xitty.local';
-- DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE 'seed_%@xitty.local');
-- DELETE FROM auth.users WHERE email LIKE 'seed_%@xitty.local';
-- COMMIT;
