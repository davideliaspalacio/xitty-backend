-- Xitty — Seed de fuentes de scraping para CARTAGENA.
--
-- Arrancamos la cobertura en los 3 focos turísticos: Centro Histórico +
-- Getsemaní (un solo centro cubre ambos), Bocagrande, y una red amplia sobre
-- toda la ciudad. Segmentamos por tipo: restaurant / tourist_attraction /
-- event_venue (Google Places) + eventos (Eventbrite).
--
-- Idempotente: `name` es UNIQUE, así que ON CONFLICT no duplica al re-correr.
-- `enabled=true` para que aparezcan en el panel admin listas para "Run".
-- Corren en mock hasta setear GOOGLE_MAPS_API_KEY / EVENTBRITE_API_KEY.

INSERT INTO public.scraping_sources (name, kind, config, enabled)
VALUES
  -- ── Centro Histórico + Getsemaní (radio 1.8km cubre ambos) ──────────────
  ('Cartagena · Centro Histórico — Restaurantes', 'google_places',
   '{"lat":10.4220,"lng":-75.5490,"radius_m":1800,"type":"restaurant","max_results":20}'::jsonb, true),
  ('Cartagena · Centro Histórico — Atracciones', 'google_places',
   '{"lat":10.4220,"lng":-75.5490,"radius_m":1800,"type":"tourist_attraction","max_results":20}'::jsonb, true),
  ('Cartagena · Centro Histórico — Eventos/venues', 'google_places',
   '{"lat":10.4220,"lng":-75.5490,"radius_m":1800,"type":"event_venue","max_results":20}'::jsonb, true),

  -- ── Bocagrande (radio 1.5km) ────────────────────────────────────────────
  ('Cartagena · Bocagrande — Restaurantes', 'google_places',
   '{"lat":10.3990,"lng":-75.5545,"radius_m":1500,"type":"restaurant","max_results":20}'::jsonb, true),
  ('Cartagena · Bocagrande — Atracciones', 'google_places',
   '{"lat":10.3990,"lng":-75.5545,"radius_m":1500,"type":"tourist_attraction","max_results":20}'::jsonb, true),

  -- ── Red amplia sobre toda Cartagena (radio 12km) ────────────────────────
  ('Cartagena · Ciudad (amplio) — Restaurantes', 'google_places',
   '{"lat":10.4100,"lng":-75.5300,"radius_m":12000,"type":"restaurant","max_results":20}'::jsonb, true),
  ('Cartagena · Ciudad (amplio) — Atracciones', 'google_places',
   '{"lat":10.4100,"lng":-75.5300,"radius_m":12000,"type":"tourist_attraction","max_results":20}'::jsonb, true),

  -- ── Eventos (Eventbrite) ────────────────────────────────────────────────
  ('Cartagena · Eventos', 'eventbrite',
   '{"location_address":"Cartagena, Colombia","location_within_km":20,"max_results":20}'::jsonb, true)
ON CONFLICT (name) DO NOTHING;
