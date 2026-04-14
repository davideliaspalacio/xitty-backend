-- ============================================================================
-- Xitty Backend — tabla user_preferences (US-002 wizard de preferencias)
-- ============================================================================
-- Reusa la función public.set_updated_at() definida en
-- 20260408000001_reset_auth_schema.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id          uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  traveler_type    text CHECK (traveler_type IN ('nomada','pareja','familia','negocios','excursion')),
  budget_min       integer CHECK (budget_min >= 0),
  budget_max       integer CHECK (budget_max >= 0),
  available_time   text CHECK (available_time IN ('1-3 dias','4-7 dias','+1 semana')),
  energy_level     text CHECK (energy_level IN ('baja','media','alta')),
  companions       integer NOT NULL DEFAULT 0 CHECK (companions >= 0),
  wizard_completed boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT budget_range_valid CHECK (
    budget_max IS NULL OR budget_min IS NULL OR budget_max >= budget_min
  )
);

CREATE INDEX IF NOT EXISTS user_preferences_wizard_idx
  ON public.user_preferences (wizard_completed);

-- Trigger updated_at (reusa función existente)
DROP TRIGGER IF EXISTS user_preferences_set_updated_at ON public.user_preferences;
CREATE TRIGGER user_preferences_set_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Row Level Security
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_preferences_select_own" ON public.user_preferences;
CREATE POLICY "user_preferences_select_own"
  ON public.user_preferences FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_preferences_insert_own" ON public.user_preferences;
CREATE POLICY "user_preferences_insert_own"
  ON public.user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_preferences_update_own" ON public.user_preferences;
CREATE POLICY "user_preferences_update_own"
  ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_preferences_delete_own" ON public.user_preferences;
CREATE POLICY "user_preferences_delete_own"
  ON public.user_preferences FOR DELETE
  USING (auth.uid() = user_id);
