-- ============================================================================
-- Xitty Backend — harden microsite interactions against accidental inflation
-- ============================================================================
-- Adds anonymous-session hashing and app-level dedup metadata. The backend
-- stores no raw session id, no IP address and no raw user-agent.
-- ============================================================================

ALTER TABLE public.microsite_interactions
  ADD COLUMN IF NOT EXISTS anonymous_session_hash text,
  ADD COLUMN IF NOT EXISTS user_agent_hash text,
  ADD COLUMN IF NOT EXISTS dedup_key text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.microsite_interactions.anonymous_session_hash IS
  'SHA-256 hash of the frontend anonymous session id. Raw id is never stored.';
COMMENT ON COLUMN public.microsite_interactions.user_agent_hash IS
  'SHA-256 hash of the request user-agent for aggregate debugging without storing raw UA.';
COMMENT ON COLUMN public.microsite_interactions.dedup_key IS
  'App-computed key for best-effort dedup by place/event/promo/actor/time bucket.';
COMMENT ON COLUMN public.microsite_interactions.metadata IS
  'Reserved structured metadata for tracking source/version; must not contain PII.';

CREATE UNIQUE INDEX IF NOT EXISTS microsite_interactions_dedup_key_uidx
  ON public.microsite_interactions (dedup_key)
  WHERE dedup_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS microsite_interactions_actor_date_idx
  ON public.microsite_interactions (place_id, anonymous_session_hash, created_at DESC)
  WHERE anonymous_session_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS microsite_interactions_place_type_date_idx
  ON public.microsite_interactions (place_id, interaction_type, created_at DESC);

-- Keep old environments compatible with hero ad impressions.
ALTER TABLE public.microsite_interactions
  DROP CONSTRAINT IF EXISTS microsite_interactions_interaction_type_check;

ALTER TABLE public.microsite_interactions
  ADD CONSTRAINT microsite_interactions_interaction_type_check
  CHECK (interaction_type IN (
    'profile_view',
    'call_click',
    'whatsapp_click',
    'reservation_click',
    'directions_click',
    'promo_view',
    'ad_impression'
  ));
