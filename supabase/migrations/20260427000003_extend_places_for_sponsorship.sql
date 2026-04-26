-- ============================================================================
-- M7 — Sponsored placements (US-031): inline columns on places
-- ============================================================================

ALTER TABLE public.places ADD COLUMN IF NOT EXISTS is_sponsored boolean NOT NULL DEFAULT false;
ALTER TABLE public.places ADD COLUMN IF NOT EXISTS sponsored_until timestamptz;
ALTER TABLE public.places ADD COLUMN IF NOT EXISTS sponsored_at timestamptz;

CREATE INDEX IF NOT EXISTS places_sponsored_idx
  ON public.places (sponsored_until DESC)
  WHERE is_sponsored = true;

-- Helper: returns true only when both flag and expiry are valid right now.
CREATE OR REPLACE FUNCTION public.is_currently_sponsored(p_place_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_sponsored AND sponsored_until > now()
     FROM public.places WHERE id = p_place_id),
    false
  );
$$;

-- Note: we deliberately do NOT add a separate UPDATE policy restricting these
-- columns to admins. The existing "places_update_owner" policy still applies,
-- but at the API layer the sponsorship endpoints sit behind an admin role
-- check (req.user.role === 'admin'). The backend uses the service-role key
-- which bypasses RLS, so authorization is enforced in the service layer.
