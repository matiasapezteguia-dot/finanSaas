-- =====================================================================
-- Registro propio de inicios de sesión, independiente de los Auth Logs
-- de Supabase (que en el plan free solo retienen 1 día).
--
-- Cada vez que auth.users.last_sign_in_at cambia (= alguien inició
-- sesión), un trigger inserta una fila en public.demo_access_log con
-- el user_id, el email (copiado, para no tener que cruzar con
-- auth.users al consultarlo) y el nuevo last_sign_in_at.
--
-- demo_access_log queda con RLS habilitado y CERO policies a propósito:
-- eso bloquea todo acceso para anon/authenticated (incluido el usuario
-- demo con su propia anon key) sin necesidad de REVOKE explícito — los
-- únicos que pueden leerla son roles con BYPASSRLS (service_role,
-- conexión directa como postgres vía Navicat/SQL Editor).
-- =====================================================================

-- ------------------------------------------------------------------
-- 1. Tabla de log
-- ------------------------------------------------------------------
CREATE TABLE public.demo_access_log (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id       uuid,
  email         text,
  logged_in_at  timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT demo_access_log_pkey PRIMARY KEY (id),
  CONSTRAINT demo_access_log_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users (id) ON DELETE SET NULL ON UPDATE NO ACTION
);

-- ON DELETE SET NULL (no CASCADE): si el usuario se borra de auth.users,
-- el historial de accesos se conserva -- el email ya quedó copiado en
-- la fila, así que sigue siendo legible sin el FK.

COMMENT ON TABLE public.demo_access_log IS
  'Log manual de inicios de sesión (independiente de los Auth Logs de Supabase, que en el plan free retienen solo 1 día). Sin policies a propósito: solo accesible vía service_role o conexión directa como postgres.';

-- ------------------------------------------------------------------
-- 2. RLS habilitado, sin policies -> tabla bloqueada para
--    anon/authenticated. Solo service_role / roles BYPASSRLS pasan.
-- ------------------------------------------------------------------
ALTER TABLE public.demo_access_log ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------
-- 3. Función + trigger sobre auth.users
--
--    SECURITY DEFINER: el UPDATE sobre auth.users lo ejecuta el rol
--    interno de GoTrue (supabase_auth_admin), que no tiene por qué
--    tener privilegios sobre public.demo_access_log ni BYPASSRLS. La
--    función corre con los privilegios de su dueño (postgres, que sí
--    tiene BYPASSRLS), así el INSERT no queda bloqueado por el RLS
--    sin policies de arriba.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_demo_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.demo_access_log (user_id, email, logged_in_at)
  VALUES (NEW.id, NEW.email, NEW.last_sign_in_at);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_demo_access ON auth.users;

CREATE TRIGGER trg_log_demo_access
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at)
  EXECUTE FUNCTION public.log_demo_access();
