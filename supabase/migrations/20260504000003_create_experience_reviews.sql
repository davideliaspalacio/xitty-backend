-- ============================================================================
-- M10 — Experience reviews + photos + rating distribution (US-043)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.experience_reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id   uuid NOT NULL REFERENCES public.experiences(id) ON DELETE CASCADE,
  reservation_id  uuid REFERENCES public.experience_reservations(id) ON DELETE SET NULL,
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating          smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (experience_id, user_id)
);

CREATE INDEX IF NOT EXISTS experience_reviews_experience_idx
  ON public.experience_reviews (experience_id);
CREATE INDEX IF NOT EXISTS experience_reviews_user_idx
  ON public.experience_reviews (user_id);
CREATE INDEX IF NOT EXISTS experience_reviews_created_idx
  ON public.experience_reviews (experience_id, created_at DESC);
CREATE INDEX IF NOT EXISTS experience_reviews_rating_idx
  ON public.experience_reviews (experience_id, rating DESC);

DROP TRIGGER IF EXISTS experience_reviews_set_updated_at ON public.experience_reviews;
CREATE TRIGGER experience_reviews_set_updated_at
  BEFORE UPDATE ON public.experience_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- Multiple photos per review (US-043 mentions photos in reviews)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.experience_review_photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id     uuid NOT NULL REFERENCES public.experience_reviews(id) ON DELETE CASCADE,
  url           text NOT NULL,
  display_order smallint NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS experience_review_photos_review_idx
  ON public.experience_review_photos (review_id);

-- ────────────────────────────────────────────────────────────────────────────
-- Trigger: keep average_rating + total_reviews on experiences in sync
-- (analogous to update_place_rating from M3)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_experience_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_experience_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_experience_id := OLD.experience_id;
  ELSE
    target_experience_id := NEW.experience_id;
  END IF;

  UPDATE public.experiences
  SET
    average_rating = COALESCE(
      (SELECT ROUND(AVG(rating)::numeric, 1)
       FROM public.experience_reviews
       WHERE experience_id = target_experience_id),
      0
    ),
    total_reviews = (
      SELECT COUNT(*)
      FROM public.experience_reviews
      WHERE experience_id = target_experience_id
    )
  WHERE id = target_experience_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS experience_reviews_update_rating ON public.experience_reviews;
CREATE TRIGGER experience_reviews_update_rating
  AFTER INSERT OR UPDATE OF rating OR DELETE ON public.experience_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_experience_rating();

-- ────────────────────────────────────────────────────────────────────────────
-- RPC: rating distribution (5 rows for ratings 1..5 with counts)
-- Used by GET /experiences/:id/rating-distribution for the histogram chart.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.experience_rating_distribution(p_experience_id uuid)
RETURNS TABLE (
  rating smallint,
  count  bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH ratings(rating) AS (VALUES (1::smallint), (2), (3), (4), (5))
  SELECT
    r.rating,
    COALESCE(COUNT(er.id), 0) AS count
  FROM ratings r
  LEFT JOIN public.experience_reviews er
    ON er.rating = r.rating AND er.experience_id = p_experience_id
  GROUP BY r.rating
  ORDER BY r.rating ASC;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.experience_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience_review_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "experience_reviews_select_all" ON public.experience_reviews
  FOR SELECT USING (true);

CREATE POLICY "experience_reviews_insert_self" ON public.experience_reviews
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "experience_reviews_update_self" ON public.experience_reviews
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "experience_reviews_delete_self_or_admin" ON public.experience_reviews
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "experience_review_photos_select_all" ON public.experience_review_photos
  FOR SELECT USING (true);

CREATE POLICY "experience_review_photos_insert_owner" ON public.experience_review_photos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.experience_reviews
      WHERE id = review_id AND user_id = auth.uid()
    )
  );
