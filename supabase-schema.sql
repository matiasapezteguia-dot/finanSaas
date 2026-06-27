-- ----------------------------
-- 1. Estructura de Tipos Enumerados (ENUMs)
-- ----------------------------
DROP TYPE IF EXISTS "public"."account_type_enum" CASCADE;
CREATE TYPE "public"."account_type_enum" AS ENUM (
  'bancaria',
  'billetera',
  'cripto'
);

DROP TYPE IF EXISTS "public"."currency_enum" CASCADE;
CREATE TYPE "public"."currency_enum" AS ENUM (
  'ARS',
  'USD'
);

-- ----------------------------
-- 2. Estructura de Tablas Independientes y Catálogos
-- ----------------------------
DROP TABLE IF EXISTS "public"."account_categories" CASCADE;
CREATE TABLE "public"."account_categories" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "deleted_at" timestamptz(6),
  CONSTRAINT "account_categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "account_categories_name_key" UNIQUE ("name")
);

DROP TABLE IF EXISTS "public"."account_groups" CASCADE;
CREATE TABLE "public"."account_groups" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "deleted_at" timestamptz(6),
  CONSTRAINT "account_groups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "account_groups_name_key" UNIQUE ("name")
);

DROP TABLE IF EXISTS "public"."transaction_types" CASCADE;
CREATE TABLE "public"."transaction_types" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "name" text NOT NULL,
  "code" text NOT NULL,
  CONSTRAINT "movement_types_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "movement_types_code_key" UNIQUE ("code")
);

DROP TABLE IF EXISTS "public"."profiles" CASCADE;
CREATE TABLE "public"."profiles" (
  "id" uuid NOT NULL,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "name" text,
  "rol" text DEFAULT 'admin'::text,
  CONSTRAINT "profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- ----------------------------
-- 3. Estructura de Tablas Principales
-- ----------------------------
DROP TABLE IF EXISTS "public"."accounts" CASCADE;
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
  CONSTRAINT "accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "accounts_account_category_id_fkey" FOREIGN KEY ("account_category_id") REFERENCES "public"."account_categories" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "accounts_account_group_id_fkey" FOREIGN KEY ("account_group_id") REFERENCES "public"."account_groups" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

DROP TABLE IF EXISTS "public"."transactions" CASCADE;
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
  CONSTRAINT "transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."account_categories" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "transactions_movement_type_id_fkey" FOREIGN KEY ("transaction_type_id") REFERENCES "public"."transaction_types" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);

-- ----------------------------
-- 4. Funciones de Seguridad de Acceso
-- ----------------------------
DROP FUNCTION IF EXISTS "public"."check_allowed_users"();
CREATE FUNCTION "public"."check_allowed_users"()
  RETURNS "pg_catalog"."trigger" AS $BODY$
BEGIN
  -- Reemplazar las direcciones de correo por las autorizadas en tu sistema
  IF NEW.email IN ('tu-gmail-dueno@gmail.com', 'el-otro-gmail-valido@gmail.com') THEN
    RETURN NEW;
  ELSE
    RAISE EXCEPTION 'Acceso denegado. Este correo no está autorizado.';
  END IF;
END;
$BODY$
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER
  COST 100;

-- ----------------------------
-- 5. Inserción de Semillas Básicas (Seeds)
-- ----------------------------
INSERT INTO public.transaction_types (name, code)
VALUES
    ('Ingreso', 'income'),
    ('Egreso', 'expense'),
    ('Transferencia', 'transfer'),
    ('Ajuste', 'adjustment')
ON CONFLICT (code) DO NOTHING;