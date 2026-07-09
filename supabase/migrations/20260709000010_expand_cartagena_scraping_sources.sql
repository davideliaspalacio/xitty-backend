-- ============================================================================
-- Xitty Backend - expanded Cartagena scraping source plan
-- ============================================================================
-- F1 data PR: versioned, idempotent source coverage for Cartagena. This does
-- not publish places or rehost photos automatically; it prepares admin-run
-- sources segmented by zone and Google Places type so the moderation queue can
-- be populated reproducibly.
-- ============================================================================

WITH source_seed(name, kind, config, enabled) AS (
  VALUES
    -- Centro Historico / Walled City
    (
      'Cartagena · Centro Histórico — Restaurantes',
      'google_places',
      '{"city":"Cartagena","zone":"Centro Histórico","lat":10.4220,"lng":-75.5490,"radius_m":1800,"type":"restaurant","max_results":20,"intended_category":"restaurantes"}'::jsonb,
      true
    ),
    (
      'Cartagena · Centro Histórico — Atracciones',
      'google_places',
      '{"city":"Cartagena","zone":"Centro Histórico","lat":10.4220,"lng":-75.5490,"radius_m":1800,"type":"tourist_attraction","max_results":20,"intended_category":"sitios-turisticos"}'::jsonb,
      true
    ),
    (
      'Cartagena · Centro Histórico — Eventos/venues',
      'google_places',
      '{"city":"Cartagena","zone":"Centro Histórico","lat":10.4220,"lng":-75.5490,"radius_m":1800,"type":"event_venue","max_results":20,"intended_category":"eventos"}'::jsonb,
      true
    ),

    -- Getsemani, separated from Centro to reduce accidental over-concentration.
    (
      'Cartagena · Getsemaní — Restaurantes',
      'google_places',
      '{"city":"Cartagena","zone":"Getsemaní","lat":10.4216,"lng":-75.5465,"radius_m":900,"type":"restaurant","max_results":20,"intended_category":"restaurantes"}'::jsonb,
      true
    ),
    (
      'Cartagena · Getsemaní — Atracciones',
      'google_places',
      '{"city":"Cartagena","zone":"Getsemaní","lat":10.4216,"lng":-75.5465,"radius_m":900,"type":"tourist_attraction","max_results":20,"intended_category":"sitios-turisticos"}'::jsonb,
      true
    ),

    -- San Diego / La Serrezuela
    (
      'Cartagena · San Diego — Restaurantes',
      'google_places',
      '{"city":"Cartagena","zone":"San Diego","lat":10.4275,"lng":-75.5483,"radius_m":900,"type":"restaurant","max_results":20,"intended_category":"restaurantes"}'::jsonb,
      true
    ),
    (
      'Cartagena · San Diego — Atracciones',
      'google_places',
      '{"city":"Cartagena","zone":"San Diego","lat":10.4275,"lng":-75.5483,"radius_m":900,"type":"tourist_attraction","max_results":20,"intended_category":"sitios-turisticos"}'::jsonb,
      true
    ),

    -- Bocagrande
    (
      'Cartagena · Bocagrande — Restaurantes',
      'google_places',
      '{"city":"Cartagena","zone":"Bocagrande","lat":10.3990,"lng":-75.5545,"radius_m":1500,"type":"restaurant","max_results":20,"intended_category":"restaurantes"}'::jsonb,
      true
    ),
    (
      'Cartagena · Bocagrande — Atracciones',
      'google_places',
      '{"city":"Cartagena","zone":"Bocagrande","lat":10.3990,"lng":-75.5545,"radius_m":1500,"type":"tourist_attraction","max_results":20,"intended_category":"sitios-turisticos"}'::jsonb,
      true
    ),
    (
      'Cartagena · Bocagrande — Eventos/venues',
      'google_places',
      '{"city":"Cartagena","zone":"Bocagrande","lat":10.3990,"lng":-75.5545,"radius_m":1500,"type":"event_venue","max_results":20,"intended_category":"eventos"}'::jsonb,
      true
    ),

    -- Castillogrande / El Laguito
    (
      'Cartagena · Castillogrande/El Laguito — Restaurantes',
      'google_places',
      '{"city":"Cartagena","zone":"Castillogrande/El Laguito","lat":10.3917,"lng":-75.5600,"radius_m":1300,"type":"restaurant","max_results":20,"intended_category":"restaurantes"}'::jsonb,
      true
    ),
    (
      'Cartagena · Castillogrande/El Laguito — Atracciones',
      'google_places',
      '{"city":"Cartagena","zone":"Castillogrande/El Laguito","lat":10.3917,"lng":-75.5600,"radius_m":1300,"type":"tourist_attraction","max_results":20,"intended_category":"sitios-turisticos"}'::jsonb,
      true
    ),

    -- Manga
    (
      'Cartagena · Manga — Restaurantes',
      'google_places',
      '{"city":"Cartagena","zone":"Manga","lat":10.4136,"lng":-75.5355,"radius_m":1500,"type":"restaurant","max_results":20,"intended_category":"restaurantes"}'::jsonb,
      true
    ),
    (
      'Cartagena · Manga — Atracciones',
      'google_places',
      '{"city":"Cartagena","zone":"Manga","lat":10.4136,"lng":-75.5355,"radius_m":1500,"type":"tourist_attraction","max_results":20,"intended_category":"sitios-turisticos"}'::jsonb,
      true
    ),
    (
      'Cartagena · Manga — Eventos/venues',
      'google_places',
      '{"city":"Cartagena","zone":"Manga","lat":10.4136,"lng":-75.5355,"radius_m":1500,"type":"event_venue","max_results":20,"intended_category":"eventos"}'::jsonb,
      true
    ),

    -- Crespo / Marbella
    (
      'Cartagena · Crespo/Marbella — Restaurantes',
      'google_places',
      '{"city":"Cartagena","zone":"Crespo/Marbella","lat":10.4387,"lng":-75.5181,"radius_m":2500,"type":"restaurant","max_results":20,"intended_category":"restaurantes"}'::jsonb,
      true
    ),
    (
      'Cartagena · Crespo/Marbella — Atracciones',
      'google_places',
      '{"city":"Cartagena","zone":"Crespo/Marbella","lat":10.4387,"lng":-75.5181,"radius_m":2500,"type":"tourist_attraction","max_results":20,"intended_category":"sitios-turisticos"}'::jsonb,
      true
    ),

    -- La Boquilla / Zona Norte
    (
      'Cartagena · La Boquilla/Zona Norte — Restaurantes',
      'google_places',
      '{"city":"Cartagena","zone":"La Boquilla/Zona Norte","lat":10.4710,"lng":-75.4950,"radius_m":5500,"type":"restaurant","max_results":20,"intended_category":"restaurantes"}'::jsonb,
      true
    ),
    (
      'Cartagena · La Boquilla/Zona Norte — Atracciones',
      'google_places',
      '{"city":"Cartagena","zone":"La Boquilla/Zona Norte","lat":10.4710,"lng":-75.4950,"radius_m":5500,"type":"tourist_attraction","max_results":20,"intended_category":"sitios-turisticos"}'::jsonb,
      true
    ),

    -- Baru / Pasacaballos
    (
      'Cartagena · Barú/Pasacaballos — Restaurantes',
      'google_places',
      '{"city":"Cartagena","zone":"Barú/Pasacaballos","lat":10.2469,"lng":-75.5897,"radius_m":10000,"type":"restaurant","max_results":20,"intended_category":"restaurantes"}'::jsonb,
      true
    ),
    (
      'Cartagena · Barú/Pasacaballos — Atracciones',
      'google_places',
      '{"city":"Cartagena","zone":"Barú/Pasacaballos","lat":10.2469,"lng":-75.5897,"radius_m":10000,"type":"tourist_attraction","max_results":20,"intended_category":"sitios-turisticos"}'::jsonb,
      true
    ),

    -- Islas del Rosario, important for tourist planning but kept as its own zone.
    (
      'Cartagena · Islas del Rosario — Atracciones',
      'google_places',
      '{"city":"Cartagena","zone":"Islas del Rosario","lat":10.1785,"lng":-75.7500,"radius_m":12000,"type":"tourist_attraction","max_results":20,"intended_category":"sitios-turisticos"}'::jsonb,
      true
    ),
    (
      'Cartagena · Islas del Rosario — Restaurantes',
      'google_places',
      '{"city":"Cartagena","zone":"Islas del Rosario","lat":10.1785,"lng":-75.7500,"radius_m":12000,"type":"restaurant","max_results":20,"intended_category":"restaurantes"}'::jsonb,
      true
    ),

    -- City-wide catch-all sources kept, but with explicit metadata.
    (
      'Cartagena · Ciudad (amplio) — Restaurantes',
      'google_places',
      '{"city":"Cartagena","zone":"Ciudad amplia","lat":10.4100,"lng":-75.5300,"radius_m":12000,"type":"restaurant","max_results":20,"intended_category":"restaurantes"}'::jsonb,
      true
    ),
    (
      'Cartagena · Ciudad (amplio) — Atracciones',
      'google_places',
      '{"city":"Cartagena","zone":"Ciudad amplia","lat":10.4100,"lng":-75.5300,"radius_m":12000,"type":"tourist_attraction","max_results":20,"intended_category":"sitios-turisticos"}'::jsonb,
      true
    ),
    (
      'Cartagena · Ciudad (amplio) — Eventos/venues',
      'google_places',
      '{"city":"Cartagena","zone":"Ciudad amplia","lat":10.4100,"lng":-75.5300,"radius_m":12000,"type":"event_venue","max_results":20,"intended_category":"eventos"}'::jsonb,
      true
    ),

    -- Eventbrite remains one broad source because it already accepts an address radius.
    (
      'Cartagena · Eventos',
      'eventbrite',
      '{"city":"Cartagena","zone":"Ciudad amplia","location_address":"Cartagena, Colombia","location_within_km":25,"max_results":50,"intended_category":"eventos"}'::jsonb,
      true
    )
)
INSERT INTO public.scraping_sources (name, kind, config, enabled)
SELECT name, kind, config, enabled
FROM source_seed
ON CONFLICT (name) DO UPDATE
SET
  kind = EXCLUDED.kind,
  config = EXCLUDED.config,
  enabled = EXCLUDED.enabled,
  updated_at = now();
