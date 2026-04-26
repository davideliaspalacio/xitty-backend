-- ============================================================================
-- M5 — Business notification settings (US-025)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.business_notification_settings (
  user_id                  uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  notify_call_click        boolean NOT NULL DEFAULT true,
  notify_whatsapp_click    boolean NOT NULL DEFAULT true,
  notify_reservation_click boolean NOT NULL DEFAULT true,
  daily_summary            boolean NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS business_notification_settings_set_updated_at ON public.business_notification_settings;
CREATE TRIGGER business_notification_settings_set_updated_at
  BEFORE UPDATE ON public.business_notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.business_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_settings_select_own" ON public.business_notification_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notif_settings_insert_own" ON public.business_notification_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notif_settings_update_own" ON public.business_notification_settings
  FOR UPDATE USING (auth.uid() = user_id);
