-- =====================================================================
-- finansaas_portfolio — policy de INSERT faltante en profiles
--
-- No hay trigger en auth.users ni código en la app que cree el profile
-- automáticamente (Providers.tsx solo hace SELECT). seed_demo.sql inserta
-- el profile del usuario demo directo con service role, que bypassea RLS,
-- así que esta policy no era requisito para ese flujo — se agrega igual
-- por consistencia con las policies de SELECT/UPDATE ya aplicadas, por si
-- en el futuro se crea un usuario nuevo a mano sin volver a correr el seed.
-- =====================================================================

CREATE POLICY "Crear el propio perfil" ON "public"."profiles"
  FOR INSERT WITH CHECK (auth.uid() = id);
