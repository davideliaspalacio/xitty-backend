-- ============================================================================
-- Xitty Backend — schema mínimo para el módulo auth (reset)
-- ============================================================================
-- Esta migración asume que se aplica sobre una DB limpia o que las tablas
-- previas (profiles vieja, preferences, etc.) ya no son necesarias. No hace
-- DROP de nada para evitar pérdida accidental de datos.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Tabla profiles
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text,
  full_name   text,
  phone       text,
  role        text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'business', 'admin')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (email);
CREATE INDEX IF NOT EXISTS profiles_role_idx  ON public.profiles (role);

-- ----------------------------------------------------------------------------
-- 2) Tabla user_roles (histórico/multi-rol opcional)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user', 'business', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON public.user_roles (user_id);

-- ----------------------------------------------------------------------------
-- 3) Trigger: auto-rellenar profiles.email desde auth.users
--    (el service hace insert sin pasar el email, esto lo soluciona)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profiles_fill_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL THEN
    SELECT email INTO NEW.email FROM auth.users WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_fill_email_trigger ON public.profiles;
CREATE TRIGGER profiles_fill_email_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_fill_email();

-- ----------------------------------------------------------------------------
-- 4) Trigger: actualizar updated_at automáticamente
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5) Row Level Security
--    El backend usa la SERVICE ROLE KEY que bypassea RLS, pero igual lo
--    activamos por buenas prácticas.
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- profiles: cada usuario puede leer y editar su propio perfil
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- user_roles: cada usuario puede ver sus propios roles
DROP POLICY IF EXISTS "user_roles_select_own" ON public.user_roles;
CREATE POLICY "user_roles_select_own"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);
