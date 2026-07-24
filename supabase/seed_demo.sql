-- =====================================================================
-- Seed de datos ficticios — usuario demo, finansaas_portfolio
--
-- Requisito previo: crear manualmente en Supabase Auth (Dashboard o
-- `supabase auth admin`) un usuario con email demo@finansaas.app.
-- Este script NO crea el usuario de auth — solo puebla datos de negocio
-- una vez que ese usuario ya existe en auth.users.
--
-- Re-ejecutable: si se corre de nuevo, borra y vuelve a insertar las
-- cuentas/transacciones/perfil del usuario demo (los catálogos
-- account_groups/account_categories se reutilizan por nombre).
--
-- Correr con el service role (bypassa RLS) vía SQL Editor de Supabase
-- o `supabase db execute` — NUNCA con la anon key.
-- =====================================================================

DO $$
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
  -- ------------------------------------------------------------------
  -- 0. Resolver usuario demo
  -- ------------------------------------------------------------------
  SELECT id INTO v_user_id FROM auth.users WHERE email = demo_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No existe ningún usuario en auth.users con email %. Creá el usuario demo primero en Supabase Auth.', demo_email;
  END IF;

  -- ------------------------------------------------------------------
  -- 1. Perfil
  -- ------------------------------------------------------------------
  INSERT INTO public.profiles (id, name, rol)
  VALUES (v_user_id, 'Usuario Demo', 'admin')
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

  -- ------------------------------------------------------------------
  -- 2. Catálogos (compartidos, upsert por nombre)
  -- ------------------------------------------------------------------
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

  -- ------------------------------------------------------------------
  -- 3. Limpiar datos demo previos de este usuario (reseed idempotente)
  -- ------------------------------------------------------------------
  DELETE FROM public.transactions WHERE user_id = v_user_id;
  DELETE FROM public.accounts WHERE user_id = v_user_id;

  -- ------------------------------------------------------------------
  -- 4. Cuentas
  -- ------------------------------------------------------------------
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

  -- ------------------------------------------------------------------
  -- 5. Transacciones — ~3 meses (mayo a julio 2026), variadas
  -- ------------------------------------------------------------------

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

  RAISE NOTICE 'Seed demo completo para user_id = %', v_user_id;
END $$;
