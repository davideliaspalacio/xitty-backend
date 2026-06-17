-- ============================================================================
-- Xitty Backend — Chat AI module (Gemini Flash + RAG simple por SQL)
-- ============================================================================
-- Tres tablas:
--   1) chat_conversations  — un row por conversacion del usuario
--   2) chat_messages       — mensajes (user/assistant/system) en orden
--   3) chat_usage_daily    — contador diario para rate limit (30/dia default)
--
-- RLS: el usuario solo puede ver/modificar sus propias conversaciones y los
-- mensajes asociados (via FK). El backend Nest usa service_role y bypasea RLS.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1) chat_conversations
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_conversations_user_updated_idx
  ON public.chat_conversations (user_id, updated_at DESC);

DROP TRIGGER IF EXISTS chat_conversations_set_updated_at ON public.chat_conversations;
CREATE TRIGGER chat_conversations_set_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- 2) chat_messages
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('user','assistant','system')),
  content         text NOT NULL,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_conversation_created_idx
  ON public.chat_messages (conversation_id, created_at);

-- ────────────────────────────────────────────────────────────────────────────
-- 3) chat_usage_daily  (rate limit por user/dia)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_usage_daily (
  user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date           date NOT NULL DEFAULT CURRENT_DATE,
  message_count  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS chat_usage_daily_user_date_idx
  ON public.chat_usage_daily (user_id, date DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- RPC increment_chat_usage(user_id) -> integer
-- Inserta/incrementa el contador de hoy y retorna el count total del dia.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_chat_usage(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.chat_usage_daily (user_id, date, message_count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, date) DO UPDATE
    SET message_count = public.chat_usage_daily.message_count + 1
  RETURNING message_count INTO v_count;

  RETURN v_count;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_usage_daily   ENABLE ROW LEVEL SECURITY;

-- chat_conversations: solo el dueño
DROP POLICY IF EXISTS "chat_conversations_select_own" ON public.chat_conversations;
CREATE POLICY "chat_conversations_select_own"
  ON public.chat_conversations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "chat_conversations_insert_own" ON public.chat_conversations;
CREATE POLICY "chat_conversations_insert_own"
  ON public.chat_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "chat_conversations_update_own" ON public.chat_conversations;
CREATE POLICY "chat_conversations_update_own"
  ON public.chat_conversations FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "chat_conversations_delete_own" ON public.chat_conversations;
CREATE POLICY "chat_conversations_delete_own"
  ON public.chat_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- chat_messages: acceso solo si el usuario es dueño de la conversacion
DROP POLICY IF EXISTS "chat_messages_select_own" ON public.chat_messages;
CREATE POLICY "chat_messages_select_own"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "chat_messages_insert_own" ON public.chat_messages;
CREATE POLICY "chat_messages_insert_own"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "chat_messages_update_own" ON public.chat_messages;
CREATE POLICY "chat_messages_update_own"
  ON public.chat_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "chat_messages_delete_own" ON public.chat_messages;
CREATE POLICY "chat_messages_delete_own"
  ON public.chat_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

-- chat_usage_daily: solo lectura por el dueño (escritura via RPC service_role)
DROP POLICY IF EXISTS "chat_usage_daily_select_own" ON public.chat_usage_daily;
CREATE POLICY "chat_usage_daily_select_own"
  ON public.chat_usage_daily FOR SELECT
  USING (auth.uid() = user_id);
