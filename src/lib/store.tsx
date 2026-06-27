import { create, StoreApi } from 'zustand';
import { Account, Transaction, StoreState, AccountCategory, FinanzasStoreContextType, MonedaType } from '../types/finanzas';

// 🔑 IMPORTACIÓN EXCLUSIVA DE REPOSITORIOS (Adiós fugas de Supabase)
import { supabase } from './supabaseClient'; 
import { SupabaseAccountRepository } from './repositories/SupabaseAccountRepository';
import { SupabaseTransactionRepository } from './repositories/SupabaseTransactionRepository';
import { SupabaseCatalogRepository } from './repositories/SupabaseCatalogRepository';

// Instanciamos los repositorios una única vez usando el cliente tipado
const accountRepo = new SupabaseAccountRepository(supabase);
const transactionRepo = new SupabaseTransactionRepository(supabase);
const catalogRepo = new SupabaseCatalogRepository(supabase);

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
    // 🔑 Consulta coordinada puramente a través de los métodos de lectura de los Repositorios
    const [
      groupsData,
      categoriesData,
      transactionTypes,
      transactions,
      domainAccounts
    ] = await Promise.all([
      catalogRepo.fetchGroups(),
      catalogRepo.fetchCategories(),
      catalogRepo.fetchTransactionTypes(),
      transactionRepo.fetchAll(),
      accountRepo.fetchAll()
    ]);

    // Preservamos el orden alfabético requerido por la UI
    const accountGroups = [...groupsData].sort((a, b) => a.name.localeCompare(b.name));
    const accountCategories = [...categoriesData].sort((a, b) => a.name.localeCompare(b.name));

    // Mapeamos los datos del dominio inyectando las propiedades virtuales necesarias para la vista
    const mappedAccounts: Account[] = domainAccounts.map((acc) => {
      const grupoObj = accountGroups.find(g => g.id === acc.account_group_id);
      const catObj = accountCategories.find(c => c.id === acc.account_category_id);

      return {
        ...acc,
        nombre: acc.nombre || 'Sin Nombre',
        grupo: grupoObj ? grupoObj.name : 'Otros',
        categoria: catObj ? catObj.name : 'Sin Categoría'
      };
    }).sort((a, b) => a.nombre.localeCompare(b.nombre));

    set({
      accountGroups,
      accountCategories,
      transactionTypes,
      transactions,
      accounts: mappedAccounts
    });
  } catch (err) {
    console.error('❌ Error real atrapado en las consultas del Store:', JSON.stringify(err, null, 2));
  } finally {
    set({ isFetching: false });
  }
};

export const useFinanzasStore = create<FinanzasStoreContextType>((set, get) => {
  return {
    ...initialState,

    setProfile: (profile) => set({ profile }),

    fetchInitialData: () => fetchInitialDataLogic(set, get),

    // =========================================================================
    // 📊 OPERACIONES DE MOVIMIENTOS REFACTORIZADAS (USANDO REPOSITORIOS)
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

        // Delegación directa al repositorio de transacciones
        await transactionRepo.save({
          account_id,
          amount,
          description: description || '',
          transaction_date,
          moneda,
          transaction_type_id,
          category_id: category_id || '',
          related_transaction_id,
          is_voided: false
        });

        await get().fetchInitialData();
      } catch (err: any) {
        console.error('❌ Error crítico en el hilo de addTransaction:', err.message || err);
        alert(`Error inesperado al guardar la transacción: ${err.message || 'Desconocido'}`);
      } finally {
        set({ isFetching: false });
      }
    },

    deleteTransaction: async (id: string) => {
      try {
        await transactionRepo.softDelete(id);
        await get().fetchInitialData();
      } catch (err) {
        console.error('❌ Error al eliminar transacción:', err);
      }
    },

    addTransfer: async (transferData) => {
      if (get().isFetching) return;
      set({ isFetching: true });

      try {
        // 🔑 Máxima abstracción: Toda la coreografía de partida doble ahora vive en el Repositorio
        const sourceAccountName = get().accounts.find(acc => acc.id === transferData.sourceAccountId)?.nombre || 'otra cuenta';
        const targetAccountName = get().accounts.find(acc => acc.id === transferData.targetAccountId)?.nombre || 'otra cuenta';

        await transactionRepo.addTransfer(transferData, sourceAccountName, targetAccountName);
        await get().fetchInitialData();
      } catch (err: any) {
        console.error('❌ Error al procesar transferencia:', err);
        alert(`Error inesperado al guardar la transferencia: ${err.message || 'Desconocido'}`);
        throw err;
      } finally {
        set({ isFetching: false });
      }
    },

    addAccount: async (nuevaCuenta) => {
      try {
        await accountRepo.save(nuevaCuenta);
        await get().fetchInitialData();
      } catch (err) {
        console.error('❌ Error al insertar cuenta:', err);
      }
    },

    updateAccount: async (cuentaModificada) => {
      try {
        await accountRepo.update(cuentaModificada.id, cuentaModificada);
        await get().fetchInitialData();
      } catch (err) {
        console.error('❌ Error al actualizar cuenta:', err);
      }
    },

    deleteAccount: async (id: string) => {
      try {
        await accountRepo.softDelete(id);
        await get().fetchInitialData();
      } catch (err) {
        console.error('❌ Error al borrar cuenta:', err);
      }
    },

    addAccountGroup: async (name: string) => {
      try {
        await catalogRepo.addGroup(name);
        await get().fetchInitialData();
      } catch (error) {
        console.error("❌ Error al agregar grupo:", error);
      }
    },

    updateAccountGroup: async (id: string, newName: string) => {
      try {
        await catalogRepo.updateGroup(id, newName);
        await get().fetchInitialData();
      } catch (error) {
        console.error("❌ Error al actualizar grupo:", error);
      }
    },

    deleteAccountGroup: async (id: string) => {
      try {
        await catalogRepo.softDeleteGroup(id);
        await get().fetchInitialData();
      } catch (error) {
        console.error("❌ Error al borrar grupo:", error);
      }
    },

    addAccountCategory: async (name: string) => {
      try {
        await catalogRepo.addCategory(name);
        await get().fetchInitialData();
      } catch (error) {
        console.error("❌ Error al agregar categoría:", error);
      }
    },

    updateAccountCategory: async (id: string, newName: string) => {
      try {
        await catalogRepo.updateCategory(id, newName);
        await get().fetchInitialData();
      } catch (error) {
        console.error("❌ Error al actualizar categoría:", error);
      }
    },

    deleteAccountCategory: async (id: string) => {
      try {
        await catalogRepo.softDeleteCategory(id);
        await get().fetchInitialData();
      } catch (error) {
        console.error("❌ Error al borrar categoría:", error);
      }
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

        // Optimistic update para mantener la UI veloz
        set({ transactions: transaccionesModificadas });

        await transactionRepo.voidTransaction(id);
        await get().fetchInitialData();
      } catch (err) {
        console.error('❌ Error en voidTransaction:', err);
      }
    }
  };
});