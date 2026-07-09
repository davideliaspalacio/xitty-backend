-- ============================================================================
-- F8 — Sponsored placements: priority slots + automatic expiry cleanup
-- ============================================================================

ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS sponsorship_priority smallint NOT NULL DEFAULT 0;

ALTER TABLE public.places
  DROP CONSTRAINT IF EXISTS places_sponsorship_priority_check;

ALTER TABLE public.places
  ADD CONSTRAINT places_sponsorship_priority_check
  CHECK (sponsorship_priority BETWEEN 0 AND 100);

CREATE INDEX IF NOT EXISTS places_active_sponsorship_priority_idx
  ON public.places (sponsorship_priority DESC, sponsored_until DESC)
  WHERE is_sponsored = true;

CREATE OR REPLACE FUNCTION public.expire_sponsorships()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE public.places
  SET
    is_sponsored = false,
    sponsorship_priority = 0,
    updated_at = now()
  WHERE is_sponsored = true
    AND sponsored_until IS NOT NULL
    AND sponsored_until <= now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-sponsorships-hourly') THEN
      PERFORM cron.unschedule('expire-sponsorships-hourly');
    END IF;

    PERFORM cron.schedule(
      'expire-sponsorships-hourly',
      '0 * * * *',
      $cron$ SELECT public.expire_sponsorships(); $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron extension not enabled — sponsorships still expire at read time; run SELECT public.expire_sponsorships() manually if needed.';
  END IF;
END
$$;

SELECT public.expire_sponsorships();
