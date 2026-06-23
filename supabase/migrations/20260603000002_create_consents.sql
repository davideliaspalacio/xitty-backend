-- ============================================================================
-- Xitty Backend — tabla user_consents (Ley 1581 Colombia — GDPR-like)
-- ============================================================================
-- Permite al usuario otorgar y revocar consentimiento sobre tracking de
-- geolocalización, analítica de chat y marketing. Cumple con el principio de
-- libertad y revocabilidad de la Ley Estatutaria 1581 de 2012.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_consents (
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  consent_type text NOT NULL CHECK (
    consent_type IN ('location_tracking', 'chat_analytics', 'marketing')
  ),
  granted      boolean NOT NULL,
  granted_at   timestamptz NOT NULL DEFAULT now(),
  revoked_at   timestamptz,
  PRIMARY KEY (user_id, consent_type)
);

CREATE INDEX IF NOT EXISTS user_consents_user_idx
  ON public.user_consents (user_id);

CREATE INDEX IF NOT EXISTS user_consents_type_idx
  ON public.user_consents (consent_type);

-- ============================================================================
-- Row Level Security — el usuario solo puede ver/modificar sus propios consents
-- service_role bypassa RLS automáticamente (la usa el backend Nest).
-- ============================================================================
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_consents_select_own" ON public.user_consents;
CREATE POLICY "user_consents_select_own"
  ON public.user_consents FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_consents_insert_own" ON public.user_consents;
CREATE POLICY "user_consents_insert_own"
  ON public.user_consents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_consents_update_own" ON public.user_consents;
CREATE POLICY "user_consents_update_own"
  ON public.user_consents FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_consents_delete_own" ON public.user_consents;
CREATE POLICY "user_consents_delete_own"
  ON public.user_consents FOR DELETE
  USING (auth.uid() = user_id);
