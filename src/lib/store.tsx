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
    const [
      groupsRes,
      categoriesRes,
      typesRes,
      transactionsRes,
      accountsRes
    ] = await Promise.all([
      supabase.from('account_groups').select('id, name').is('deleted_at', null).order('name'),
      supabase.from('account_categories').select('id, name').is('deleted_at', null).order('name'),
      supabase.from('transaction_types').select('id, name, code'),
      supabase.from('transactions').select('*').is('deleted_at', null).order('transaction_date', { ascending: false }),
      // 🔑 CORREGIDO: Se agregó .order('name') para que las cuentas mantengan SIEMPRE el mismo orden alfabético
      supabase.from('accounts').select('id, created_at, name, currency, initial_amount, current_amount, account_group_id, account_category_id').is('deleted_at', null).order('name')
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
  } catch (err) {
    console.error('❌ Error real atrapado en las consultas del Store:', JSON.stringify(err, null, 2));
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

    set({ [stateKey]: filteredState } as Partial<StoreState>);

    try {
      const { error } = await supabase
        .from(tableName)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        set({ [stateKey]: previousState } as Partial<StoreState>);
        alert(`No se pudo borrar lógicamente: ${error.message}`);
      }
    } catch (err) {
      console.error(`❌ Error crítico al ejecutar soft delete genérico para ${tableName}:`, err);
      set({ [stateKey]: previousState } as Partial<StoreState>);
    }
  };

  return {
    ...initialState,

    setProfile: (profile) => set({ profile }),

    fetchInitialData: () => fetchInitialDataLogic(set, get),

    // =========================================================================
    // 📊 OPERACIONES DE MOVIMIENTOS REFACTORIZADAS (PROPIEDADES REALES)
    // =========================================================================
    addTransaction: async (transaction) => {
      if (get().isFetching) return;
      set({ isFetching: true });

      try {
        const { account_id, amount, description, transaction_date, moneda, transaction_type_id, category_id, related_transaction_id } = transaction;

        if (!account_id) throw new Error("El ID de la cuenta no puede estar vacío.");
        if (!transaction_type_id) throw new Error("El ID del tipo de transacción no puede estar vacío.");

        const transactionTypes = get().transactionTypes;
        const movementType = transactionTypes.find(type => type.id === transaction_type_id);
        if (!movementType) throw new Error("Tipo de movimiento no encontrado.");

        const movementCode = movementType.code;

        if (!category_id && movementCode !== 'transfer') {
          throw new Error("❌ Error: category_id es requerido para registrar la transacción.");
        }

        // Insertar la transacción principal
        const { data, error } = await supabase
          .from('transactions')
          .insert({
            account_id: account_id,
            amount: amount,
            description: description,
            transaction_date: transaction_date,
            currency: moneda, // 🔑 CAMBIO: Mapeamos la variable 'moneda' al campo real 'currency'
            transaction_type_id: transaction_type_id,
            category_id: category_id,
            related_transaction_id: related_transaction_id,
          } as any)
          .select();

        if (error) throw new Error(`Error al insertar transacción: ${error.message}`);

        await get().fetchInitialData();

      } catch (err: any) {
        console.error('❌ Error crítico en el hilo de addTransaction:', err.message || err);
        alert(`Error inesperado al guardar la transacción: ${err.message || 'Desconocido'}`);
      } finally {
        set({ isFetching: false });
      }
    },

    deleteTransaction: async (id: string) => {
      await ejecutarSoftDeleteGenerico('transactions', id, 'transactions');
    },

    addTransfer: async (transferData) => {
      if (get().isFetching) return;
      set({ isFetching: true }); // 🔑 BLINDAJE: Evita doble clic y registros duplicados

      try {
        const {
          sourceAccountId,
          targetAccountId,
          amount,
          description,
          transactionDate,
          currency,
          transactionTypeId
        } = transferData;

        // 1. Definimos la pierna de salida (Outflow)
        const outflowTransaction = {
          account_id: sourceAccountId,
          amount: -Math.abs(amount),
          description: description + ` (Transferencia a ${get().accounts.find(acc => acc.id === targetAccountId)?.nombre || 'otra cuenta'})`,
          transaction_date: transactionDate,
          currency: currency,
          transaction_type_id: transactionTypeId,
          category_id: null,
          related_transaction_id: null,
        };

        // 2. Insertamos la salida en Supabase con bypass de tipo 'as any'
        const { data: outflowData, error: outflowError } = await supabase
          .from('transactions')
          .insert([outflowTransaction] as any)
          .select();

        if (outflowError) throw outflowError;
        if (!outflowData || outflowData.length === 0) throw new Error("No se recibieron datos de la transacción de salida.");
        const insertedOutflowId = outflowData[0].id;

        // 3. Definimos la pierna de entrada (Inflow) vinculando el ID de la salida
        const inflowTransaction = {
          account_id: targetAccountId,
          amount: Math.abs(amount),
          description: description + ` (Transferencia desde ${get().accounts.find(acc => acc.id === sourceAccountId)?.nombre || 'otra cuenta'})`,
          transaction_date: transactionDate,
          currency: currency,
          transaction_type_id: transactionTypeId,
          category_id: null,
          related_transaction_id: insertedOutflowId,
        };

        // 4. Insertamos la entrada en Supabase con bypass de tipo 'as any'
        const { data: inflowData, error: inflowError } = await supabase
          .from('transactions')
          .insert([inflowTransaction] as any)
          .select();

        if (inflowError) throw inflowError;
        if (!inflowData || inflowData.length === 0) throw new Error("No se recibieron datos de la transacción de entrada.");
        const insertedInflowId = inflowData[0].id;

        // 5. Vinculamos de regreso la salida con el ID de la entrada
        const { error: updateError } = await supabase
          .from('transactions')
          .update({ related_transaction_id: insertedInflowId } as any)
          .eq('id', insertedOutflowId);

        if (updateError) throw updateError;

        // 🔑 RECARGA SÍNCRONA: Actualiza la UI reactivamente sin reloads
        await get().fetchInitialData();

      } catch (err: any) {
        console.error('❌ Error al procesar transferencia:', err);
        alert(`Error inesperado al guardar la transferencia: ${err.message || 'Desconocido'}`);
        throw err;
      } finally {
        set({ isFetching: false }); // 🔑 Liberamos el formulario
      }
    },

    addAccount: async (nuevaCuenta) => {
      try {
        const { error } = await supabase
          .from('accounts')
          .insert([{
            name: nuevaCuenta.nombre,
            currency: nuevaCuenta.moneda,
            initial_amount: nuevaCuenta.montoInicial,
            current_amount: nuevaCuenta.montoInicial,
            account_group_id: nuevaCuenta.account_group_id,
            account_category_id: nuevaCuenta.account_category_id
          } as any]);

        if (error) throw error;
        await get().fetchInitialData();
      } catch (err) {
        console.error('❌ Error al insertar cuenta:', err);
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
          } as any)
          .eq('id', cuentaModificada.id);

        if (error) throw error;
        await get().fetchInitialData();
      } catch (err) {
        console.error('❌ Error al actualizar cuenta:', err);
      }
    },

    deleteAccount: async (id: string) => {
      await ejecutarSoftDeleteGenerico('accounts', id, 'accounts');
    },

    addAccountGroup: async (name: string) => {
      try {
        const { error } = await supabase.from('account_groups').insert([{ name } as any]);
        if (error) throw error;
        await get().fetchInitialData();
      } catch (error) {
        console.error("❌ Error al agregar grupo:", error);
      }
    },

    updateAccountGroup: async (id: string, newName: string) => {
      try {
        const { error } = await supabase.from('account_groups').update({ name: newName } as any).eq('id', id);
        if (error) throw error;
        await get().fetchInitialData();
      } catch (error) {
        console.error("❌ Error al actualizar grupo:", error);
      }
    },

    deleteAccountGroup: async (id: string) => {
      await ejecutarSoftDeleteGenerico('account_groups', id, 'accountGroups');
    },

    addAccountCategory: async (name: string) => {
      try {
        const { error } = await supabase.from('account_categories').insert([{ name } as any]);
        if (error) throw error;
        await get().fetchInitialData();
      } catch (error) {
        console.error("❌ Error al agregar categoría:", error);
      }
    },

    updateAccountCategory: async (id: string, newName: string) => {
      try {
        const { error } = await supabase.from('account_categories').update({ name: newName } as any).eq('id', id);
        if (error) throw error;
        await get().fetchInitialData();
      } catch (error) {
        console.error("❌ Error al actualizar categoría:", error);
      }
    },

    deleteAccountCategory: async (id: string) => {
      await ejecutarSoftDeleteGenerico('account_categories', id, 'accountCategories');
    },

    getAccountBalance: (accountId: string) => {
      const account = get().accounts.find((a) => a.id === accountId);
      if (!account) return 0;

      const balance = get().transactions
        .filter((t) => t.account_id === accountId)
        .reduce((acc, t) => {
          if (t.is_voided) return acc;
          return acc + t.amount;
        }, account.montoInicial);

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
        const transaccionesPrevias = get().transactions;
        const transaccionesModificadas = transaccionesPrevias.map(t =>
          t.id === id ? { ...t, is_voided: true } : t
        );

        set({ transactions: transaccionesModificadas });

        const { error } = await supabase
          .from('transactions')
          .update({ is_voided: true } as any)
          .eq('id', id);

        if (error) {
          set({ transactions: transaccionesPrevias });
          alert(`No se pudo anular: ${error.message}`);
        } else {
          get().fetchInitialData();
        }
      } catch (err) {
        console.error('❌ Error en voidTransaction:', err);
      }
    }

  };
});