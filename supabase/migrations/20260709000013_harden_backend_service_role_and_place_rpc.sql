-- ============================================================================
-- Xitty Backend - service role privileges and nearby places RPC cleanup
-- ============================================================================
-- Clean Supabase projects do not automatically grant application-table access to
-- service_role. The Nest backend uses service_role for data access while keeping
-- user/business/admin authorization in application code + RLS policies.
--
-- This migration also removes pre-city overloads of list_places_near so PostgREST
-- has one city/zone-aware RPC signature to resolve.
-- ============================================================================

DROP FUNCTION IF EXISTS public.list_places_near(
  double precision,
  double precision,
  uuid,
  smallint,
  integer,
  integer
);

DROP FUNCTION IF EXISTS public.list_places_near(
  double precision,
  double precision,
  uuid,
  smallint,
  integer,
  integer,
  integer
);

GRANT USAGE ON SCHEMA public TO service_role;

DO $$
DECLARE
  app_relation record;
BEGIN
  FOR app_relation IN
    SELECT n.nspname AS schema_name, c.relname AS relation_name, c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend d
        JOIN pg_extension e ON e.oid = d.refobjid
        WHERE d.objid = c.oid
          AND d.deptype = 'e'
      )
  LOOP
    IF app_relation.relkind IN ('r', 'p') THEN
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I.%I TO service_role',
        app_relation.schema_name,
        app_relation.relation_name
      );
    ELSE
      EXECUTE format(
        'GRANT SELECT ON TABLE %I.%I TO service_role',
        app_relation.schema_name,
        app_relation.relation_name
      );
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  app_sequence record;
BEGIN
  FOR app_sequence IN
    SELECT n.nspname AS schema_name, c.relname AS sequence_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'S'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend d
        JOIN pg_extension e ON e.oid = d.refobjid
        WHERE d.objid = c.oid
          AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format(
      'GRANT USAGE, SELECT, UPDATE ON SEQUENCE %I.%I TO service_role',
      app_sequence.schema_name,
      app_sequence.sequence_name
    );
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.compute_recommendations_for(
  uuid,
  double precision,
  double precision,
  integer
) TO service_role;

GRANT EXECUTE ON FUNCTION public.experience_rating_distribution(uuid)
  TO service_role;

GRANT EXECUTE ON FUNCTION public.increment_chat_usage(uuid)
  TO service_role;

GRANT EXECUTE ON FUNCTION public.list_places_near(
  double precision,
  double precision,
  uuid,
  smallint,
  text,
  text,
  integer,
  integer,
  integer
) TO service_role;

GRANT EXECUTE ON FUNCTION public.place_metrics_summary(
  uuid,
  timestamp with time zone,
  timestamp with time zone
) TO service_role;

GRANT EXECUTE ON FUNCTION public.place_metrics_timeseries(
  uuid,
  timestamp with time zone,
  timestamp with time zone,
  text
) TO service_role;

GRANT EXECUTE ON FUNCTION public.refresh_place_rankings()
  TO service_role;

GRANT EXECUTE ON FUNCTION public.suggestions_for(
  double precision,
  double precision
) TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO service_role;
