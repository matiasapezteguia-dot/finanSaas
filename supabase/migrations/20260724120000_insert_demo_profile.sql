-- =====================================================================
-- finansaas_portfolio — crear el profile faltante del usuario demo
--
-- No existe trigger en auth.users -> public.profiles (confirmado con
-- `select tgname, tgrelid::regclass from pg_trigger where tgname ilike
-- '%user%'` — sin resultados) ni código en la app que cree el profile
-- al loguearse (Providers.tsx solo hace SELECT). Por eso el usuario
-- demo@finansaas.app nunca tuvo fila en profiles y la app tira
-- "Error fetching profile: {}" al loguear.
--
-- Es un caso puntual de un único usuario ya existente en auth.users,
-- así que en vez de un trigger general se inserta la fila directamente
-- acá, resolviendo el id por email. Idempotente vía ON CONFLICT.
-- =====================================================================

INSERT INTO public.profiles (id, name, rol)
SELECT id, 'Usuario Demo', 'admin'
FROM auth.users
WHERE email = 'demo@finansaas.app'
ON CONFLICT (id) DO NOTHING;
