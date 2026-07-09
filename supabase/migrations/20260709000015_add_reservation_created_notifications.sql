-- ============================================================================
-- Xitty Backend - reservation-created notifications
-- ============================================================================
-- F6 initially queued CTA clicks and daily summaries. Actual experience
-- reservations should also notify the operator through the same provider-neutral
-- outbox while the external delivery channel remains pending.
-- ============================================================================

ALTER TABLE public.business_notification_outbox
  DROP CONSTRAINT IF EXISTS business_notification_outbox_notification_type_check;

ALTER TABLE public.business_notification_outbox
  ADD CONSTRAINT business_notification_outbox_notification_type_check
  CHECK (notification_type IN (
    'call_click',
    'whatsapp_click',
    'reservation_click',
    'reservation_created',
    'daily_summary'
  ));

COMMENT ON CONSTRAINT business_notification_outbox_notification_type_check
  ON public.business_notification_outbox IS
  'Provider-neutral notification types captured before external delivery is configured.';
