-- ============================================================================
-- Xitty Backend - notification outbox for business preferences
-- ============================================================================
-- F6 closes the gap between saved notification preferences and actual event
-- handling. Delivery channel/provider remains pending, so this migration stores
-- notifications in an internal outbox that a later worker can deliver.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.business_notification_outbox (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  place_id           uuid REFERENCES public.places(id) ON DELETE CASCADE,
  interaction_id     uuid REFERENCES public.microsite_interactions(id) ON DELETE SET NULL,
  notification_type  text NOT NULL CHECK (notification_type IN (
    'call_click',
    'whatsapp_click',
    'reservation_click',
    'daily_summary'
  )),
  channel            text NOT NULL DEFAULT 'pending' CHECK (channel IN (
    'pending',
    'email',
    'push',
    'whatsapp'
  )),
  status             text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'sent',
    'failed',
    'skipped'
  )),
  dedup_key          text,
  payload            jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for      timestamptz NOT NULL DEFAULT now(),
  sent_at            timestamptz,
  error_message      text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.business_notification_outbox IS
  'Internal queue of business notifications. Delivery provider/channel is configured later.';
COMMENT ON COLUMN public.business_notification_outbox.channel IS
  'pending means the app captured intent but no delivery provider has been selected yet.';
COMMENT ON COLUMN public.business_notification_outbox.dedup_key IS
  'Stable key to keep retries from duplicating notifications.';

CREATE INDEX IF NOT EXISTS business_notification_outbox_recipient_status_idx
  ON public.business_notification_outbox (recipient_user_id, status, scheduled_for DESC);

CREATE INDEX IF NOT EXISTS business_notification_outbox_place_created_idx
  ON public.business_notification_outbox (place_id, created_at DESC)
  WHERE place_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS business_notification_outbox_dedup_key_uidx
  ON public.business_notification_outbox (dedup_key)
  WHERE dedup_key IS NOT NULL;

DROP TRIGGER IF EXISTS business_notification_outbox_set_updated_at
  ON public.business_notification_outbox;
CREATE TRIGGER business_notification_outbox_set_updated_at
  BEFORE UPDATE ON public.business_notification_outbox
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.business_notification_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_outbox_select_owner" ON public.business_notification_outbox;
CREATE POLICY "notification_outbox_select_owner"
  ON public.business_notification_outbox
  FOR SELECT
  USING (
    recipient_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "notification_outbox_update_admin" ON public.business_notification_outbox;
CREATE POLICY "notification_outbox_update_admin"
  ON public.business_notification_outbox
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION public.enqueue_daily_business_summaries(
  p_for_date date DEFAULT ((now() AT TIME ZONE 'America/Bogota')::date - 1)
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from timestamptz := (p_for_date::timestamp AT TIME ZONE 'America/Bogota');
  v_to   timestamptz := ((p_for_date + 1)::timestamp AT TIME ZONE 'America/Bogota');
  v_inserted integer := 0;
BEGIN
  INSERT INTO public.business_notification_outbox (
    recipient_user_id,
    place_id,
    notification_type,
    channel,
    status,
    dedup_key,
    payload,
    scheduled_for
  )
  SELECT
    p.owner_id,
    mi.place_id,
    'daily_summary',
    'pending',
    'pending',
    format('daily_summary:%s:%s:%s', p.owner_id, mi.place_id, p_for_date),
    jsonb_build_object(
      'date', p_for_date::text,
      'place_id', mi.place_id,
      'profile_views', COUNT(*) FILTER (WHERE mi.interaction_type = 'profile_view'),
      'call_clicks', COUNT(*) FILTER (WHERE mi.interaction_type = 'call_click'),
      'whatsapp_clicks', COUNT(*) FILTER (WHERE mi.interaction_type = 'whatsapp_click'),
      'reservation_clicks', COUNT(*) FILTER (WHERE mi.interaction_type = 'reservation_click'),
      'directions_clicks', COUNT(*) FILTER (WHERE mi.interaction_type = 'directions_click'),
      'promo_views', COUNT(*) FILTER (WHERE mi.interaction_type = 'promo_view'),
      'total_interactions', COUNT(*)
    ),
    now()
  FROM public.microsite_interactions mi
  JOIN public.places p
    ON p.id = mi.place_id
   AND p.owner_id IS NOT NULL
   AND COALESCE(p.is_active, true) = true
  LEFT JOIN public.business_notification_settings settings
    ON settings.user_id = p.owner_id
  WHERE mi.created_at >= v_from
    AND mi.created_at < v_to
    AND COALESCE(settings.daily_summary, true) = true
  GROUP BY p.owner_id, mi.place_id
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM cron.job
      WHERE jobname = 'enqueue-daily-business-summaries'
    ) THEN
      PERFORM cron.unschedule('enqueue-daily-business-summaries');
    END IF;

    PERFORM cron.schedule(
      'enqueue-daily-business-summaries',
      '0 12 * * *',
      $cron$SELECT public.enqueue_daily_business_summaries();$cron$
    );
  END IF;
END $$;
