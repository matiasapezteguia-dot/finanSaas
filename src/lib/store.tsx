import { create, StoreApi } from 'zustand';
import { Account, Transaction, StoreState, AccountCategory, FinanzasStoreContextType, MonedaType } from '../types/finanzas';
// 🔑 IMPORTACIÓN UNIFICADA CENTRALIZADA
import { supabase } from '../lib/supabaseClient';

const initialState: StoreState = {
  transactions: [],
  accounts: [],
  accountGroups: [],
  accountCategories: [],
  transactionTypes: [],
  profile: null,
  isFetching: false,
};

const fetchInitialDataLogic = async (set: StoreApi<FinanzasStoreContextType>['setState'], get: StoreApi<FinanzasStoreContextType>['getState']) => {
  if (typeof window === 'undefined') {
    return;
  }

  set({ isFetching: true });

  try {
    console.log("🕵️‍♂️ DETECTOR: Iniciando ráfaga paralela de alta velocidad hacia Supabase...");

    const [
      groupsRes,
      categoriesRes,
      typesRes,
      transactionsRes,
      accountsRes
    ] = await Promise.all([
      supabase.from('account_groups').select('id, name').is('deleted_at', null),
      supabase.from('account_categories').select('id, name').is('deleted_at', null),
      supabase.from('transaction_types').select('id, name, code'),
      supabase.from('transactions').select('*').is('deleted_at', null),
      supabase.from('accounts').select('id, created_at, name, currency, initial_amount, current_amount, account_group_id, account_category_id').is('deleted_at', null)
    ]);

    if (groupsRes.error) throw groupsRes.error;
    if (categoriesRes.error) throw categoriesRes.error;
    if (typesRes.error) throw typesRes.error;
    if (transactionsRes.error) throw transactionsRes.error;
    if (accountsRes.error) throw accountsRes.error;

    const accountGroups = groupsRes.data || [];
    const accountCategories = categoriesRes.data || [];
    const transactionTypes = typesRes.data || [];
    const rawAccounts = accountsRes.data || [];

    console.log("⚡ ¡Ráfaga exitosa! Datos base sincronizados.");

    const mappedAccounts: Account[] = rawAccounts.map((acc) => {
      const grupoObj = accountGroups.find(g => g.id === acc.account_group_id);
      const catObj = accountCategories.find(c => c.id === acc.account_category_id);

      return {
        id: acc.id,
        nombre: acc.name || 'Sin Nombre',
        moneda: (acc.currency as 'ARS' | 'USD') || 'ARS',
        montoInicial: Number(acc.initial_amount) || 0,
        current_amount: Number(acc.current_amount) || 0,
        user_id: null,
        created_at: acc.created_at,
        account_group_id: acc.account_group_id || '',
        account_category_id: acc.account_category_id || '',
        grupo: grupoObj ? grupoObj.name : 'Otros',
        categoria: catObj ? catObj.name : 'Sin Categoría'
      };
    });

    set({
      accountGroups: accountGroups as any[],
      accountCategories: accountCategories as any[],
      transactionTypes: transactionTypes as any[],
      transactions: transactionsRes.data || [],
      accounts: mappedAccounts
    });

    console.log("🎉 ¡ÉXITO TOTAL! Todo el Store se actualizó correctamente.");
  } catch (err) {
    console.error('🔥 Error real atrapado en las consultas del Store:', JSON.stringify(err, null, 2));
  } finally {
    set({ isFetching: false });
  }
};

export const useFinanzasStore = create<FinanzasStoreContextType>((set, get) => {

  const ejecutarSoftDeleteGenerico = async <K extends keyof StoreState>(
    tableName: string,
    id: string,
    stateKey: K
  ) => {
    type ItemType = StoreState[K] extends (infer U)[] ? U : never;
    if (!Array.isArray(get()[stateKey])) {
      console.error(`Error: ${String(stateKey)} no es un array en el estado.`);
      return;
    }
    const previousState = get()[stateKey] as ItemType[];
    const filteredState = previousState.filter((item) => (item as any).id !== id);

    console.log(`✨ OPTIMISTIC: Removiendo ${id} de ${String(stateKey)} de la pantalla.`);
    set({ [stateKey]: filteredState } as Partial<StoreState>);

    try {
      const { error } = await supabase
        .from(tableName)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error(`❌ Error diferido al borrar lógicamente en Supabase (${tableName}):`, error);
        set({ [stateKey]: previousState } as Partial<StoreState>); // Revert optimistic update
        alert(`No se pudo borrar lógicamente: ${error.message}`);
      } else {
        console.log(`✅ Servidor confirmó el borrado lógico de ${id} en ${tableName}.`);
        // No es necesario fetchInitialData aquí, ya que el filtro .is('deleted_at', null) se encargará en el próximo fetch
      }
    } catch (err) {
      console.error(`🔥 Error crítico al ejecutar soft delete genérico para ${tableName}:`, err);
      set({ [stateKey]: previousState } as Partial<StoreState>); // Revert optimistic update
    }
  };

  return {
    ...initialState,

    setProfile: (profile) => set({ profile }),

    fetchInitialData: () => fetchInitialDataLogic(set, get),

    // =========================================================================
    // 📊 OPERACIONES DE MOVIMIENTOS OPTIMIZADAS (EN INGLÉS DEFINITIVO)
    // =========================================================================
    addTransaction: async (transaction: Omit<Transaction, 'id' | 'created_at'>) => {
      if (get().isFetching) return;

      set({ isFetching: true }); // Set fetching at the beginning

      try {
        console.log("📝 Insertando transacción de forma directa...");

        const t = transaction as any;
        const payload: any = {
          transaction_date: t.fecha || t.date || t.transaction_date,
          description: t.descripcion || t.description,
          amount: Number(t.monto || t.amount) || 0,
          currency: t.moneda || t.currency,
          account_id: t.cuentaId || t.account_id,
          transaction_type_id: t.transaction_type_id || t.typeId,
        };

        console.log("Payload de la transacción:", payload); // Log del payload

        // No se requiere user_id directamente en el payload de transactions, se asocia via account_id
        // La lógica de obtener el user_id de la sesión se elimina.

        // Si se necesitara validar que el usuario está autenticado antes de proceder,
        // se podría mantener la siguiente lógica, pero sin asignarla al payload de transaction.
        // const { data: { session } } = await supabase.auth.getSession();
        // const userId = session?.user?.id;
        // if (!userId) {
        //   console.error('🔥 Error: No se pudo obtener el ID del usuario de la sesión de Supabase.');
        //   alert('No se pudo guardar la transacción: Usuario no autenticado.');
        //   return; // Exit early if no user ID
        // }

        // console.log("Payload de la transacción (final):", payload); // Log del payload final sin user_id


        const { error } = await supabase.from('transactions').insert([payload]);

        if (error) {
          console.error('🔥 Error retornado por Supabase:', error);
          alert(`Error de base de datos: ${error.message}`);
        } else {
          console.log("✅ Servidor confirmó la inserción con éxito.");
          await get().fetchInitialData();
        }
      } catch (err: any) { // Catch any error in the entire process
        console.error('🔥 Error crítico en el hilo de addTransaction:', err);
        alert(`Error inesperado al guardar la transacción: ${err.message || 'Desconocido'}`);
      } finally {
        set({ isFetching: false }); // Ensure isFetching is reset
      }
    },

    deleteTransaction: async (id: string) => {
      await ejecutarSoftDeleteGenerico('transactions', id, 'transactions');
    },

    // =========================================================================
    // 💳 OPERACIONES DE CUENTAS ENCAPSULADAS
    // =========================================================================
    addAccount: async (nuevaCuenta) => {
      try {
        console.log("📝 Insertando cuenta de forma directa:", nuevaCuenta);

        const { error } = await supabase
          .from('accounts')
          .insert([{
            name: nuevaCuenta.nombre,
            currency: nuevaCuenta.moneda,
            initial_amount: nuevaCuenta.montoInicial,
            current_amount: nuevaCuenta.montoInicial,
            account_group_id: nuevaCuenta.account_group_id,
            account_category_id: nuevaCuenta.account_category_id
          }]);

        if (error) throw error;
        await get().fetchInitialData();
      } catch (err) {
        console.error('🔥 Error al insertar cuenta:', err);
      }
    },

    updateAccount: async (cuentaModificada) => {
      try {
        const { error } = await supabase
          .from('accounts')
          .update({
            name: cuentaModificada.nombre,
            currency: cuentaModificada.moneda,
            initial_amount: cuentaModificada.montoInicial,
            account_group_id: cuentaModificada.account_group_id,
            account_category_id: cuentaModificada.account_category_id
          })
          .eq('id', cuentaModificada.id);

        if (error) throw error;
        await get().fetchInitialData();
      } catch (err) {
        console.error('🔥 Error al actualizar cuenta:', err);
      }
    },

    deleteAccount: async (id: string) => {
      await ejecutarSoftDeleteGenerico('accounts', id, 'accounts');
    },

    // =========================================================================
    // 📁 MANTENIMIENTO DE ESTRUCTURAS SECUNDARIAS
    // =========================================================================
    addAccountGroup: async (name: string) => {
      try {
        const { error } = await supabase.from('account_groups').insert([{ name }]);
        if (error) throw error;
        await get().fetchInitialData();
      } catch (error) {
        console.error("🔥 Error al agregar grupo:", error);
      }
    },

    updateAccountGroup: async (id: string, newName: string) => {
      try {
        const { error } = await supabase.from('account_groups').update({ name: newName }).eq('id', id);
        if (error) throw error;
        await get().fetchInitialData();
      } catch (error) {
        console.error("🔥 Error al actualizar grupo:", error);
      }
    },

    deleteAccountGroup: async (id: string) => {
      await ejecutarSoftDeleteGenerico('account_groups', id, 'accountGroups');
    },

    addAccountCategory: async (name: string) => {
      try {
        const { error } = await supabase.from('account_categories').insert([{ name }]);
        if (error) throw error;
        await get().fetchInitialData();
      } catch (error) {
        console.error("🔥 Error al agregar categoría:", error);
      }
    },

    updateAccountCategory: async (id: string, newName: string) => {
      try {
        const { error } = await supabase.from('account_categories').update({ name: newName }).eq('id', id);
        if (error) throw error;
        await get().fetchInitialData();
      } catch (error) {
        console.error("🔥 Error al actualizar categoría:", error);
      }
    },

    deleteAccountCategory: async (id: string) => {
      await ejecutarSoftDeleteGenerico('account_categories', id, 'accountCategories');
    },

    // =========================================================================
    // 🧠 INTELIGENCIA CONTABLE INTEGRADORA
    // =========================================================================
    getAccountBalance: (accountId) => {
      const cuenta = get().accounts.find((a) => a.id === accountId);
      if (!cuenta) return 0;

      const balance = get().transactions
        .filter((t) => (t as any).account_id === accountId || (t as any).cuentaId === accountId)
        .reduce((acc, t) => {
          // 🔑 NUEVO CANDADO: Si la transacción está anulada, no altera el balance de la cuenta
          if ((t as any).is_voided) {
            return acc;
          }

          const tipoEncontrado = get().transactionTypes.find(
            (tt) => tt.id === (t as any).transaction_type_id || tt.id === (t as any).typeId
          );

          const nombreTipo = tipoEncontrado?.name?.toLowerCase().trim() || '';
          const codigoTipo = tipoEncontrado?.code?.toLowerCase().trim() || '';

          // 🔑 CORREGIDO: "amount" bien escrito y con (t as any)
          const montoAbs = Math.abs((t as any).amount || (t as any).monto || 0);

          if (nombreTipo === 'ingreso' || codigoTipo === 'income') {
            return acc + montoAbs;
          } else if (nombreTipo === 'egreso' || codigoTipo === 'expense') {
            return acc - montoAbs;
          } else {
            // 🔑 CORREGIDO: "amount" bien escrito acá también
            const m = (t as any).amount || (t as any).monto || 0;
            return m < 0 ? acc - montoAbs : acc + m;
          }
        }, cuenta.montoInicial);

      return isNaN(balance) ? 0 : balance;
    },

    getBalance: (currency: MonedaType) => {
      const total = get().accounts
        .filter((a) => a.moneda === currency)
        .reduce((acc, a) => acc + get().getAccountBalance(a.id), 0);
      return isNaN(total) ? 0 : total;
    },

    getTotalARS: () => get().getBalance('ARS'),
    getTotalUSD: () => get().getBalance('USD'),

    getAvailableARS: () => {
      const total = get().accounts
        .filter((a) => a.moneda === 'ARS' && a.categoria !== 'Inversiones' && a.categoria !== 'Inversión')
        .reduce((acc, a) => acc + get().getAccountBalance(a.id), 0);
      return isNaN(total) ? 0 : total;
    },

    getTotalARSInvestments: () => {
      const total = get().accounts
        .filter((a) => a.moneda === 'ARS' && (a.categoria === 'Inversiones' || a.categoria === 'Inversión'))
        .reduce((acc, a) => acc + get().getAccountBalance(a.id), 0);
      return isNaN(total) ? 0 : total;
    },

    getBalancesByGroup: (currency: MonedaType) => {
      const res: { [key: string]: number } = {};
      get().accounts
        .filter((a) => a.moneda === currency)
        .forEach((a) => {
          const grupo = a.grupo || 'Otros';
          res[grupo] = (res[grupo] || 0) + get().getAccountBalance(a.id);
        });
      return res;
    },

    getBalancesByCategory: (currency: MonedaType) => {
      const res: { [key: string]: number } = {};
      get().accounts
        .filter((a) => a.moneda === currency)
        .forEach((a) => {
          const cat = a.categoria || 'Sin Categoría';
          res[cat] = (res[cat] || 0) + get().getAccountBalance(a.id);
        });
      return res;
    },

    voidTransaction: async (id: string) => {
      try {
        // 1. ACTUALIZACIÓN OPTIMISTA: Cambiamos el estado en la UI al instante
        const transaccionesPrevias = get().transactions;
        const transaccionesModificadas = transaccionesPrevias.map(t =>
          t.id === id ? { ...t, is_voided: true } : t
        );

        console.log(`✨ OPTIMISTIC (Void): Anulando transacción ${id} en la UI.`);
        set({ transactions: transaccionesModificadas });

        // 2. ACTUALIZACIÓN EN BASE DE DATOS
        supabase
          .from('transactions')
          .update({ is_voided: true })
          .eq('id', id)
          .then(({ error }) => {
            if (error) {
              console.error("❌ Error al anular transacción:", error);
              // Rollback si falla el servidor
              set({ transactions: transaccionesPrevias });
              alert(`No se pudo anular: ${error.message}`);
            } else {
              console.log("✅ Servidor confirmó la anulación con éxito.");
              get().fetchInitialData(); // Recarga de fondo para recalcular todo
            }
          });
      } catch (err) {
        console.error('🔥 Error crítico en voidTransaction:', err);
      }
    }
  };
});