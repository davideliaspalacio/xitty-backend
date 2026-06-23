-- ============================================================================
-- Xitty Backend — schedule scraping (weekly trigger via pg_cron + NOTIFY)
-- ============================================================================
-- ARQUITECTURA:
--   Postgres NO ejecuta el scraping. pg_cron solo dispara un NOTIFY semanal
--   que el backend NestJS escucha. El backend recibe la notificacion y corre
--   `RunnerService.runAll()` (que es donde vive toda la logica de fetch +
--   enrichment + quality + dedup).
--
-- POR QUE NO PONER LA LOGICA DENTRO DE pg_cron:
--   - pg_cron corre dentro del proceso de Postgres. Hacer HTTP calls a TripAdvisor,
--     Google Places, etc. desde una funcion plpgsql es lento, frenaria conexiones,
--     y no podemos correr LLMs para enrichment.
--   - El backend ya tiene los clientes HTTP, las API keys, los timeouts, el
--     manejo de errores y los providers pluggables. Centralizar la orquestacion
--     ahi es lo correcto.
--
-- INTEGRACION DESDE EL BACKEND:
--   Un listener (LISTEN xitty_scraping_run) se suscribe al canal y dispara
--   RunnerService.runAll() al recibir el mensaje. La implementacion del listener
--   vive en el modulo scheduler del backend.
--
-- SCHEDULE: lunes a las 08:00 UTC (≈ 03:00 hora Colombia). Cambiar con un
--           ALTER cron.job si se necesita otra cadencia.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1) Funcion que dispara el NOTIFY
-- ────────────────────────────────────────────────────────────────────────────
-- Idempotente y SECURITY DEFINER por si la corremos manualmente desde un rol
-- distinto al owner. El payload es JSON simple con el timestamp del trigger.
CREATE OR REPLACE FUNCTION public.notify_scraping_run()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_notify(
    'xitty_scraping_run',
    json_build_object('triggered_at', now())::text
  );
END;
$$;

COMMENT ON FUNCTION public.notify_scraping_run() IS
  'Emite NOTIFY en el canal xitty_scraping_run. El backend NestJS escucha y dispara RunnerService.runAll().';

-- ────────────────────────────────────────────────────────────────────────────
-- 2) Schedule semanal via pg_cron (si la extension esta disponible)
-- ────────────────────────────────────────────────────────────────────────────
-- En Supabase Cloud pg_cron viene preinstalado pero hay que habilitarlo.
-- Lo hacemos condicional para que la migracion no rompa en entornos donde
-- pg_cron no este disponible (CI local, instancias self-hosted minimas, etc.)
DO $$
DECLARE
  has_pg_cron boolean;
  existing_job_id bigint;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron'
  ) INTO has_pg_cron;

  IF NOT has_pg_cron THEN
    RAISE NOTICE
      'pg_cron no disponible en esta instancia — saltando el schedule. '
      'Para activar el cron semanal: instala pg_cron y luego corre: '
      '  SELECT cron.schedule(''xitty-scraping-weekly'', ''0 8 * * 1'', $cron$SELECT public.notify_scraping_run()$cron$);';
    RETURN;
  END IF;

  -- Asegurarse que la extension este creada (no-op si ya existe)
  CREATE EXTENSION IF NOT EXISTS pg_cron;

  -- Si el job ya existe (re-migracion), lo borramos y re-creamos
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'xitty-scraping-weekly';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  -- Programar: lunes 08:00 UTC
  PERFORM cron.schedule(
    'xitty-scraping-weekly',
    '0 8 * * 1',
    $cron$SELECT public.notify_scraping_run()$cron$
  );

  RAISE NOTICE 'pg_cron job xitty-scraping-weekly programado (lunes 08:00 UTC).';
END;
$$;
