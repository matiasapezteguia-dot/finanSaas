-- =====================================================================
-- finansaas_portfolio — schema inicial + RLS single-user
-- Proyecto NUEVO Y VACÍO. NO correr contra el proyecto viejo
-- (finanzas_simple / luusthmybljsfhgskzdm), que sigue pausado como
-- producción real de 4 usuarios y no se toca.
--
-- Modelo: portfolio de un solo usuario demo (auth.uid() = user_id).
-- accounts y transactions quedan scoped por usuario. account_groups,
-- account_categories y transaction_types son catálogos compartidos
-- (solo hay un usuario en este proyecto, así que "compartido" no
-- introduce fuga de datos entre personas).
-- =====================================================================

-- ----------------------------
-- 1. Tipos enumerados
-- ----------------------------
CREATE TYPE "public"."account_type_enum" AS ENUM (
  'bancaria',
  'billetera',
  'cripto'
);

CREATE TYPE "public"."currency_enum" AS ENUM (
  'ARS',
  'USD'
);

-- ----------------------------
-- 2. Catálogos
-- ----------------------------
CREATE TABLE "public"."account_categories" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "deleted_at" timestamptz(6),
  CONSTRAINT "account_categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "account_categories_name_key" UNIQUE ("name")
);

CREATE TABLE "public"."account_groups" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "deleted_at" timestamptz(6),
  CONSTRAINT "account_groups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "account_groups_name_key" UNIQUE ("name")
);

CREATE TABLE "public"."transaction_types" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "name" text NOT NULL,
  "code" text NOT NULL,
  CONSTRAINT "transaction_types_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transaction_types_code_key" UNIQUE ("code")
);

-- ----------------------------
-- 3. Perfiles
-- ----------------------------
CREATE TABLE "public"."profiles" (
  "id" uuid NOT NULL,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "name" text,
  "rol" text DEFAULT 'admin'::text,
  CONSTRAINT "profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- ----------------------------
-- 4. Tablas principales (con user_id)
-- ----------------------------
CREATE TABLE "public"."accounts" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "name" text NOT NULL,
  "currency" text NOT NULL DEFAULT 'ARS'::text,
  "initial_amount" numeric NOT NULL DEFAULT 0,
  "current_amount" numeric NOT NULL DEFAULT 0,
  "account_group_id" uuid,
  "account_category_id" uuid,
  "deleted_at" timestamptz(6),
  "user_id" uuid NOT NULL DEFAULT auth.uid(),
  CONSTRAINT "accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "accounts_account_category_id_fkey" FOREIGN KEY ("account_category_id") REFERENCES "public"."account_categories" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "accounts_account_group_id_fkey" FOREIGN KEY ("account_group_id") REFERENCES "public"."account_groups" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "idx_accounts_user_id" ON "public"."accounts" ("user_id");

CREATE TABLE "public"."transactions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "account_id" uuid,
  "transaction_type_id" uuid,
  "category_id" uuid,
  "amount" numeric NOT NULL DEFAULT 0,
  "description" text,
  "transaction_date" date NOT NULL DEFAULT now(),
  "related_transaction_id" uuid,
  "currency" text NOT NULL DEFAULT 'ARS'::text,
  "exchange_rate" numeric DEFAULT 1,
  "deleted_at" timestamptz(6),
  "is_voided" bool DEFAULT false,
  "user_id" uuid NOT NULL DEFAULT auth.uid(),
  CONSTRAINT "transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."account_categories" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "transactions_movement_type_id_fkey" FOREIGN KEY ("transaction_type_id") REFERENCES "public"."transaction_types" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "idx_transactions_user_id" ON "public"."transactions" ("user_id");

-- ----------------------------
-- 5. Row Level Security
-- ----------------------------
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."account_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."account_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."transaction_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;

-- profiles: cada quien ve y edita únicamente su propio perfil
-- (reemplaza el "Public profiles are viewable by everyone." que
-- exponía todos los perfiles sin login, ver rls_fix.sql punto 1)
CREATE POLICY "Ver el propio perfil" ON "public"."profiles"
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Editar el propio perfil" ON "public"."profiles"
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- account_groups: catálogo compartido, cualquier autenticado puede
-- leer/escribir (equivalente a los fixes de rls_fix.sql punto 2,
-- que reemplazaban policies con qual/with_check = true por
-- auth.uid() IS NOT NULL)
CREATE POLICY "Leer grupos - autenticados" ON "public"."account_groups"
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Insertar grupos - autenticados" ON "public"."account_groups"
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Actualizar grupos - autenticados" ON "public"."account_groups"
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Borrar grupos - autenticados" ON "public"."account_groups"
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- account_categories: mismo criterio que account_groups
-- (rls_fix.sql punto 3)
CREATE POLICY "Leer categorias - autenticados" ON "public"."account_categories"
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Insertar categorias - autenticados" ON "public"."account_categories"
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Actualizar categorias - autenticados" ON "public"."account_categories"
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Borrar categorias - autenticados" ON "public"."account_categories"
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- transaction_types: catálogo fijo, solo lectura desde la app
CREATE POLICY "Leer tipos de transaccion - autenticados" ON "public"."transaction_types"
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- accounts: exclusivamente el dueño del registro (user_id)
CREATE POLICY "Ver cuentas propias" ON "public"."accounts"
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Insertar cuentas propias" ON "public"."accounts"
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Actualizar cuentas propias" ON "public"."accounts"
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Borrar cuentas propias" ON "public"."accounts"
  FOR DELETE USING (auth.uid() = user_id);

-- transactions: exclusivamente el dueño del registro (user_id)
CREATE POLICY "Ver transacciones propias" ON "public"."transactions"
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Insertar transacciones propias" ON "public"."transactions"
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Actualizar transacciones propias" ON "public"."transactions"
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Borrar transacciones propias" ON "public"."transactions"
  FOR DELETE USING (auth.uid() = user_id);

-- ----------------------------
-- 6. Seed de catálogo fijo (tipos de transacción)
-- ----------------------------
INSERT INTO public.transaction_types (name, code)
VALUES
    ('Ingreso', 'income'),
    ('Egreso', 'expense'),
    ('Transferencia', 'transfer'),
    ('Ajuste', 'adjustment')
ON CONFLICT (code) DO NOTHING;
