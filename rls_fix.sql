-- =====================================================================
-- Fix de políticas RLS — pymes-finanzas-app
-- Corrige: escritura anónima sin auth en account_groups/account_categories,
-- lectura pública sin auth en profiles, y duplicados redundantes.
-- Pegar y correr en el SQL Editor de Supabase.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. profiles: sacar la policy que expone todo sin login
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;

-- Quedan (sin tocar, ya están bien):
--   SELECT "Los usuarios pueden ver todos los perfiles de la empresa"  USING (auth.uid() IS NOT NULL)
--   UPDATE "Cada usuario edita su propio perfil"                      USING (auth.uid() = id)

-- ---------------------------------------------------------------------
-- 2. account_groups: sacar policies rotas (qual/with_check = true, sin auth.uid())
--    y duplicados de lectura
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.account_groups;
DROP POLICY IF EXISTS "Allow authenticated users to update groups" ON public.account_groups;
DROP POLICY IF EXISTS "Allow authenticated users to delete groups" ON public.account_groups;
DROP POLICY IF EXISTS "Permitir lectura a usuarios autenticados" ON public.account_groups;
DROP POLICY IF EXISTS "Global read groups" ON public.account_groups;

-- Queda la de lectura ya correcta: "Permitir lectura de grupos a autenticados" (auth.uid() IS NOT NULL)

CREATE POLICY "Insertar grupos - solo autenticados" ON public.account_groups
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Actualizar grupos - solo autenticados" ON public.account_groups
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Borrar grupos - solo autenticados" ON public.account_groups
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------
-- 3. account_categories: mismo problema
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.account_categories;
DROP POLICY IF EXISTS "Allow authenticated users to update categories" ON public.account_categories;
DROP POLICY IF EXISTS "Allow authenticated users to delete groups" ON public.account_categories;
DROP POLICY IF EXISTS "Permitir lectura a usuarios autenticados" ON public.account_categories;
DROP POLICY IF EXISTS "Global read categories" ON public.account_categories;

-- Queda la de lectura ya correcta: "Permitir lectura de categorias a autenticados" (auth.uid() IS NOT NULL)

CREATE POLICY "Insertar categorias - solo autenticados" ON public.account_categories
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Actualizar categorias - solo autenticados" ON public.account_categories
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Borrar categorias - solo autenticados" ON public.account_categories
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------
-- 4. Verificación — correr después de aplicar lo de arriba
-- ---------------------------------------------------------------------
-- select schemaname, tablename, policyname, cmd, qual, with_check
-- from pg_policies where schemaname = 'public'
-- order by tablename, cmd;
