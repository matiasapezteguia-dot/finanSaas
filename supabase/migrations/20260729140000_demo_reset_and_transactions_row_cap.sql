-- =====================================================================
-- Protección de la demo pública (demo@finansaas.app) contra vandalismo
-- / carga masiva por parte de visitantes que usan las credenciales
-- públicas del README.
--
-- 1. Reset automático diario de los datos del usuario demo vía pg_cron,
--    reusando la misma lógica que supabase/seed_demo.sql (envuelta en
--    una función reusable reset_demo_user()).
-- 2. Tope de filas por usuario en transactions vía trigger BEFORE
--    INSERT, para que nadie (incluido el demo) pueda floodear miles de
--    transacciones entre un reset y el otro.
--
-- pg_cron confirmado disponible en el plan free de Supabase (viene
-- habilitado en free/pro/team; el único límite es de recursos, no de
-- tier).
-- =====================================================================

-- ------------------------------------------------------------------
-- 0. Extensión pg_cron
-- ------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- ------------------------------------------------------------------
-- 1. Función reusable: reset_demo_user()
--    Misma lógica que seed_demo.sql (perfil, catálogos por upsert,
--    borrado de accounts/transactions del usuario demo, reinserción
--    de las mismas cuentas y transacciones de ejemplo).
--
--    SECURITY DEFINER porque necesita bypassear RLS para poder
--    borrar/reinsertar filas de un usuario que no es quien ejecuta el
--    job (pg_cron corre como el rol que agenda el job). Por eso mismo
--    se revoca EXECUTE de PUBLIC/authenticated/anon más abajo: esta
--    función NO debe quedar invocable vía RPC por ningún cliente.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reset_demo_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  demo_email      text := 'demo@finansaas.app';
  v_user_id       uuid;

  v_grp_banco       uuid;
  v_grp_efectivo    uuid;
  v_grp_billetera   uuid;
  v_grp_cripto      uuid;

  v_cat_operativo   uuid;
  v_cat_ahorro      uuid;
  v_cat_inversion   uuid;
  v_cat_efectivo    uuid;

  v_type_income     uuid;
  v_type_expense    uuid;
  v_type_transfer   uuid;
  v_type_adjustment uuid;

  v_acc_banco       uuid;
  v_acc_caja        uuid;
  v_acc_billetera   uuid;
  v_acc_cripto      uuid;

  v_out_leg         uuid;
  v_in_leg          uuid;
BEGIN
  -- 0. Resolver usuario demo
  SELECT id INTO v_user_id FROM auth.users WHERE email = demo_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'reset_demo_user: no existe ningún usuario en auth.users con email %.', demo_email;
  END IF;

  -- 1. Perfil
  INSERT INTO public.profiles (id, name, rol)
  VALUES (v_user_id, 'Usuario Demo', 'admin')
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

  -- 2. Catálogos (compartidos, upsert por nombre)
  INSERT INTO public.account_groups (name) VALUES ('Banco')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_grp_banco;
  INSERT INTO public.account_groups (name) VALUES ('Efectivo')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_grp_efectivo;
  INSERT INTO public.account_groups (name) VALUES ('Billetera Virtual')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_grp_billetera;
  INSERT INTO public.account_groups (name) VALUES ('Cripto')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_grp_cripto;

  INSERT INTO public.account_categories (name) VALUES ('Operativo')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_cat_operativo;
  INSERT INTO public.account_categories (name) VALUES ('Ahorro')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_cat_ahorro;
  INSERT INTO public.account_categories (name) VALUES ('Inversion')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_cat_inversion;
  INSERT INTO public.account_categories (name) VALUES ('Efectivo')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_cat_efectivo;

  SELECT id INTO v_type_income     FROM public.transaction_types WHERE code = 'income';
  SELECT id INTO v_type_expense    FROM public.transaction_types WHERE code = 'expense';
  SELECT id INTO v_type_transfer   FROM public.transaction_types WHERE code = 'transfer';
  SELECT id INTO v_type_adjustment FROM public.transaction_types WHERE code = 'adjustment';

  -- 3. Limpiar datos demo previos (reseed idempotente)
  DELETE FROM public.transactions WHERE user_id = v_user_id;
  DELETE FROM public.accounts WHERE user_id = v_user_id;

  -- 4. Cuentas
  INSERT INTO public.accounts (name, currency, initial_amount, current_amount, account_group_id, account_category_id, user_id)
    VALUES ('Cuenta Corriente Banco Demo', 'ARS', 850000, 850000, v_grp_banco, v_cat_operativo, v_user_id)
    RETURNING id INTO v_acc_banco;

  INSERT INTO public.accounts (name, currency, initial_amount, current_amount, account_group_id, account_category_id, user_id)
    VALUES ('Caja Efectivo', 'ARS', 120000, 120000, v_grp_efectivo, v_cat_efectivo, v_user_id)
    RETURNING id INTO v_acc_caja;

  INSERT INTO public.accounts (name, currency, initial_amount, current_amount, account_group_id, account_category_id, user_id)
    VALUES ('Billetera Virtual USD', 'USD', 500, 500, v_grp_billetera, v_cat_ahorro, v_user_id)
    RETURNING id INTO v_acc_billetera;

  INSERT INTO public.accounts (name, currency, initial_amount, current_amount, account_group_id, account_category_id, user_id)
    VALUES ('Wallet Cripto', 'USD', 300, 300, v_grp_cripto, v_cat_inversion, v_user_id)
    RETURNING id INTO v_acc_cripto;

  -- 5. Transacciones — mismo dataset de ejemplo que seed_demo.sql

  -- Mayo
  INSERT INTO public.transactions (account_id, transaction_type_id, category_id, amount, description, transaction_date, currency, user_id) VALUES
    (v_acc_banco, v_type_income,  v_cat_operativo, 620000,  'Cobro factura cliente A', '2026-05-02', 'ARS', v_user_id),
    (v_acc_banco, v_type_expense, v_cat_operativo, -95000,  'Alquiler oficina',        '2026-05-03', 'ARS', v_user_id),
    (v_acc_banco, v_type_expense, v_cat_operativo, -38000,  'Servicios (luz, internet)', '2026-05-05', 'ARS', v_user_id),
    (v_acc_caja,  v_type_expense, v_cat_operativo, -22000,  'Compra de insumos de oficina', '2026-05-07', 'ARS', v_user_id),
    (v_acc_banco, v_type_income,  v_cat_operativo, 410000,  'Cobro factura cliente B', '2026-05-10', 'ARS', v_user_id),
    (v_acc_banco, v_type_expense, v_cat_operativo, -180000, 'Pago sueldo empleado', '2026-05-10', 'ARS', v_user_id),
    (v_acc_banco, v_type_expense, v_cat_operativo, -15000,  'Suscripción software contable', '2026-05-12', 'ARS', v_user_id),
    (v_acc_caja,  v_type_expense, v_cat_operativo, -9500,   'Almuerzo con proveedor', '2026-05-14', 'ARS', v_user_id),
    (v_acc_banco, v_type_expense, v_cat_operativo, -3200,   'Comisión bancaria mensual', '2026-05-15', 'ARS', v_user_id),
    (v_acc_banco, v_type_income,  v_cat_operativo, 275000,  'Cobro factura cliente C', '2026-05-20', 'ARS', v_user_id),
    (v_acc_billetera, v_type_income, v_cat_ahorro, 150, 'Cobro proyecto freelance en USD', '2026-05-22', 'USD', v_user_id),
    (v_acc_banco, v_type_expense, v_cat_operativo, -42000, 'Pago proveedor insumos', '2026-05-25', 'ARS', v_user_id),
    (v_acc_cripto, v_type_income, v_cat_inversion, 40, 'Rendimiento staking', '2026-05-28', 'USD', v_user_id);

  -- Transferencia Banco -> Caja (dos patas vinculadas, como en la app)
  INSERT INTO public.transactions (account_id, transaction_type_id, category_id, amount, description, transaction_date, currency, related_transaction_id, user_id)
    VALUES (v_acc_banco, v_type_transfer, NULL, -60000, 'Transferencia a caja chica (a Caja Efectivo)', '2026-05-16', 'ARS', NULL, v_user_id)
    RETURNING id INTO v_out_leg;
  INSERT INTO public.transactions (account_id, transaction_type_id, category_id, amount, description, transaction_date, currency, related_transaction_id, user_id)
    VALUES (v_acc_caja, v_type_transfer, NULL, 60000, 'Transferencia a caja chica (desde Cuenta Corriente Banco Demo)', '2026-05-16', 'ARS', v_out_leg, v_user_id)
    RETURNING id INTO v_in_leg;
  UPDATE public.transactions SET related_transaction_id = v_in_leg WHERE id = v_out_leg;

  -- Junio
  INSERT INTO public.transactions (account_id, transaction_type_id, category_id, amount, description, transaction_date, currency, user_id) VALUES
    (v_acc_banco, v_type_income,  v_cat_operativo, 705000,  'Cobro factura cliente A', '2026-06-02', 'ARS', v_user_id),
    (v_acc_banco, v_type_expense, v_cat_operativo, -95000,  'Alquiler oficina', '2026-06-03', 'ARS', v_user_id),
    (v_acc_banco, v_type_expense, v_cat_operativo, -41000,  'Servicios (luz, internet)', '2026-06-05', 'ARS', v_user_id),
    (v_acc_banco, v_type_expense, v_cat_operativo, -180000, 'Pago sueldo empleado', '2026-06-10', 'ARS', v_user_id),
    (v_acc_banco, v_type_income,  v_cat_operativo, 390000,  'Cobro factura cliente D', '2026-06-11', 'ARS', v_user_id),
    (v_acc_caja,  v_type_expense, v_cat_operativo, -18500,  'Compra de insumos de oficina', '2026-06-13', 'ARS', v_user_id),
    (v_acc_banco, v_type_expense, v_cat_operativo, -15000,  'Suscripción software contable', '2026-06-12', 'ARS', v_user_id),
    (v_acc_banco, v_type_expense, v_cat_operativo, -60000,  'Campaña de marketing digital', '2026-06-18', 'ARS', v_user_id),
    (v_acc_banco, v_type_income,  v_cat_operativo, 512000,  'Cobro factura cliente B', '2026-06-20', 'ARS', v_user_id),
    (v_acc_billetera, v_type_expense, v_cat_ahorro, -80, 'Pago herramienta SaaS en USD', '2026-06-21', 'USD', v_user_id),
    (v_acc_banco, v_type_expense, v_cat_operativo, -3400, 'Comisión bancaria mensual', '2026-06-15', 'ARS', v_user_id),
    (v_acc_cripto, v_type_expense, v_cat_inversion, -25, 'Compra de insumos tecnológicos', '2026-06-24', 'USD', v_user_id),
    (v_acc_banco, v_type_expense, v_cat_operativo, -27000, 'Pago proveedor insumos', '2026-06-27', 'ARS', v_user_id),
    (v_acc_caja, v_type_adjustment, v_cat_efectivo, -1200, 'Ajuste de caja por arqueo', '2026-06-28', 'ARS', v_user_id);

  -- Julio (hasta el 20)
  INSERT INTO public.transactions (account_id, transaction_type_id, category_id, amount, description, transaction_date, currency, user_id) VALUES
    (v_acc_banco, v_type_income,  v_cat_operativo, 630000,  'Cobro factura cliente A', '2026-07-02', 'ARS', v_user_id),
    (v_acc_banco, v_type_expense, v_cat_operativo, -98000,  'Alquiler oficina', '2026-07-03', 'ARS', v_user_id),
    (v_acc_banco, v_type_expense, v_cat_operativo, -39500,  'Servicios (luz, internet)', '2026-07-05', 'ARS', v_user_id),
    (v_acc_banco, v_type_expense, v_cat_operativo, -185000, 'Pago sueldo empleado', '2026-07-10', 'ARS', v_user_id),
    (v_acc_banco, v_type_income,  v_cat_operativo, 455000,  'Cobro factura cliente C', '2026-07-11', 'ARS', v_user_id),
    (v_acc_banco, v_type_expense, v_cat_operativo, -15000,  'Suscripción software contable', '2026-07-12', 'ARS', v_user_id),
    (v_acc_caja,  v_type_expense, v_cat_operativo, -25400,  'Compra de insumos de oficina', '2026-07-14', 'ARS', v_user_id),
    (v_acc_banco, v_type_income,  v_cat_operativo, 298000,  'Cobro factura cliente E', '2026-07-17', 'ARS', v_user_id),
    (v_acc_billetera, v_type_income, v_cat_ahorro, 220, 'Cobro proyecto freelance en USD', '2026-07-18', 'USD', v_user_id),
    (v_acc_banco, v_type_expense, v_cat_operativo, -3300, 'Comisión bancaria mensual', '2026-07-15', 'ARS', v_user_id),
    (v_acc_cripto, v_type_income, v_cat_inversion, 55, 'Rendimiento staking', '2026-07-20', 'USD', v_user_id);

  RAISE NOTICE 'reset_demo_user: reseed completo para user_id = %', v_user_id;
END;
$$;

-- Solo el dueño de la función (postgres) puede ejecutarla: ni
-- anon/authenticated deben poder invocarla vía supabase-js .rpc().
REVOKE ALL ON FUNCTION public.reset_demo_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_demo_user() FROM anon, authenticated;

-- ------------------------------------------------------------------
-- 2. Cron job diario — 04:00 hora Argentina (UTC-3) = 07:00 UTC.
--    pg_cron siempre agenda en UTC independientemente del timezone
--    de la sesión/base.
-- ------------------------------------------------------------------
DO $$
BEGIN
  PERFORM cron.unschedule('reset-demo-user-daily');
EXCEPTION WHEN OTHERS THEN
  NULL; -- no existía el job todavía, no pasa nada
END $$;

SELECT cron.schedule(
  'reset-demo-user-daily',
  '0 7 * * *',
  $$ SELECT public.reset_demo_user(); $$
);

-- ------------------------------------------------------------------
-- 3. Tope de filas por usuario en transactions (BEFORE INSERT)
--
--    La demo arranca con ~40 transacciones. 400 da margen amplio para
--    que un visitante pruebe la app a fondo (crear, transferir, editar)
--    sin chocar el límite en uso normal, pero corta cualquier intento
--    de floodear miles de filas entre un reset y el otro. Aplica a
--    TODOS los usuarios (no solo al demo), incluyendo filas soft-
--    deleted (deleted_at) — el objetivo es limitar el volumen físico
--    en la tabla, no las filas "visibles".
--
--    No es SECURITY DEFINER: corre con los privilegios de quien
--    inserta, y el SELECT count(*) queda acotado por la policy
--    "Ver transacciones propias" (auth.uid() = user_id), que ya
--    coincide con NEW.user_id en cualquier insert legítimo.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_transactions_row_cap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_row_count integer;
  v_max_rows  CONSTANT integer := 400;
BEGIN
  SELECT count(*) INTO v_row_count
  FROM public.transactions
  WHERE user_id = NEW.user_id;

  IF v_row_count >= v_max_rows THEN
    RAISE EXCEPTION 'Límite de % transacciones por usuario alcanzado.', v_max_rows
      USING ERRCODE = '23514'; -- check_violation
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transactions_row_cap ON public.transactions;

CREATE TRIGGER trg_transactions_row_cap
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_transactions_row_cap();
