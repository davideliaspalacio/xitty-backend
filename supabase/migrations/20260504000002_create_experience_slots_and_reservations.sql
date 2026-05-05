-- ============================================================================
-- M10 — Slots + Reservations (US-041): bookable time slots with capacity tracking
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- Slots: a specific date/time with a capacity, defined by the operator.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.experience_slots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id uuid NOT NULL REFERENCES public.experiences(id) ON DELETE CASCADE,
  starts_at     timestamptz NOT NULL,
  capacity      smallint NOT NULL CHECK (capacity > 0),
  seats_taken   smallint NOT NULL DEFAULT 0 CHECK (seats_taken >= 0),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT experience_slots_capacity_check CHECK (seats_taken <= capacity),
  UNIQUE (experience_id, starts_at)
);

CREATE INDEX IF NOT EXISTS experience_slots_experience_starts_idx
  ON public.experience_slots (experience_id, starts_at)
  WHERE is_active = true;

-- ────────────────────────────────────────────────────────────────────────────
-- View: slots that are still bookable right now
-- ────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.available_experience_slots;
CREATE VIEW public.available_experience_slots AS
SELECT
  s.*,
  (s.capacity - s.seats_taken) AS seats_available
FROM public.experience_slots s
JOIN public.experiences e ON e.id = s.experience_id
WHERE s.is_active = true
  AND e.is_active = true
  AND s.starts_at > now()
  AND s.seats_taken < s.capacity;

-- ────────────────────────────────────────────────────────────────────────────
-- Reservations
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.experience_reservations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id         uuid NOT NULL REFERENCES public.experience_slots(id) ON DELETE RESTRICT,
  experience_id   uuid NOT NULL REFERENCES public.experiences(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participants    smallint NOT NULL DEFAULT 1 CHECK (participants > 0),
  total_price_cop integer NOT NULL CHECK (total_price_cop >= 0),
  status          text NOT NULL DEFAULT 'confirmed' CHECK (status IN (
    'confirmed', 'cancelled', 'completed'
  )),
  cancelled_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reservations_user_idx
  ON public.experience_reservations (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reservations_slot_idx
  ON public.experience_reservations (slot_id);
CREATE INDEX IF NOT EXISTS reservations_status_idx
  ON public.experience_reservations (status);

DROP TRIGGER IF EXISTS reservations_set_updated_at ON public.experience_reservations;
CREATE TRIGGER reservations_set_updated_at
  BEFORE UPDATE ON public.experience_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- Trigger: keep slot.seats_taken in sync. Postgres serializes UPDATEs to the
-- same row so two concurrent reservations cannot both pass the capacity check.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_slot_seats()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  new_seats smallint;
  slot_capacity smallint;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'confirmed' THEN
    UPDATE public.experience_slots
    SET seats_taken = seats_taken + NEW.participants
    WHERE id = NEW.slot_id
    RETURNING seats_taken, capacity INTO new_seats, slot_capacity;

    IF new_seats > slot_capacity THEN
      RAISE EXCEPTION 'Slot is full' USING ERRCODE = 'check_violation';
    END IF;

  ELSIF TG_OP = 'UPDATE'
        AND NEW.status = 'cancelled'
        AND OLD.status = 'confirmed' THEN
    UPDATE public.experience_slots
    SET seats_taken = GREATEST(0, seats_taken - OLD.participants)
    WHERE id = NEW.slot_id;

  ELSIF TG_OP = 'DELETE' AND OLD.status = 'confirmed' THEN
    UPDATE public.experience_slots
    SET seats_taken = GREATEST(0, seats_taken - OLD.participants)
    WHERE id = OLD.slot_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS reservations_update_slot_seats ON public.experience_reservations;
CREATE TRIGGER reservations_update_slot_seats
  AFTER INSERT OR UPDATE OF status OR DELETE ON public.experience_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_slot_seats();

-- ────────────────────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.experience_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "experience_slots_select_all" ON public.experience_slots
  FOR SELECT USING (true);

CREATE POLICY "experience_slots_insert_owner" ON public.experience_slots
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.experiences e
      JOIN public.places p ON p.id = e.operator_place_id
      WHERE e.id = experience_id AND (
        p.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );

CREATE POLICY "experience_slots_update_owner" ON public.experience_slots
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.experiences e
      JOIN public.places p ON p.id = e.operator_place_id
      WHERE e.id = experience_id AND (
        p.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );

CREATE POLICY "reservations_select_owner_or_operator" ON public.experience_reservations
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.experiences e
      JOIN public.places p ON p.id = e.operator_place_id
      WHERE e.id = experience_id AND p.owner_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "reservations_insert_self" ON public.experience_reservations
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "reservations_update_self_or_admin" ON public.experience_reservations
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
