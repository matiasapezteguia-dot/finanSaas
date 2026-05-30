import { create, StoreApi } from 'zustand';
import { Account, Transaction, StoreState, AccountCategory, FinanzasStoreContextType, MonedaType } from '../types/finanzas';
import { createClientSupabaseClient } from '../utils/supabase/client';
import { SupabaseTransactionRepository } from './repositories/SupabaseTransactionRepository';
import { SupabaseAccountRepository } from './repositories/SupabaseAccountRepository';
import { SupabaseCatalogRepository } from './repositories/SupabaseCatalogRepository';

const initialState: StoreState = {
  transactions: [],
  accounts: [],
  accountGroups: [],
  accountCategories: [],
  transactionTypes: [],
  profile: null,
  isFetching: false,
};

// 🔒 SINGLETON GLOBAL: Evita colisiones de sockets y listeners duplicados en Next.js 15+ tras F5
const globalSupabase = typeof window !== 'undefined' ? createClientSupabaseClient() : null;

const fetchInitialDataLogic = async (set: StoreApi<FinanzasStoreContextType>['setState'], get: StoreApi<FinanzasStoreContextType>['getState']) => {
  if (typeof window === 'undefined' || !globalSupabase) {
    return;
  }
  
  // Forzamos el flag para indicar que estamos consultando
  set({ isFetching: true });

  try {
    const supabaseTransactionRepository = new SupabaseTransactionRepository(globalSupabase);
    const supabaseAccountRepository = new SupabaseAccountRepository(globalSupabase);

    console.log("🕵️‍♂️ DETECTOR: Iniciando ráfaga paralela de alta velocidad hacia Supabase...");

    // Disparamos las 5 consultas en simultáneo por el mismo caño
    const [
      groupsRes,
      categoriesRes,
      typesRes,
      transactions,
      accounts
    ] = await Promise.all([
      globalSupabase.from('account_groups').select('id, name'),
      globalSupabase.from('account_categories').select('id, name'),
      globalSupabase.from('transaction_types').select('id, name, code'),
      supabaseTransactionRepository.fetchAll(),
      supabaseAccountRepository.fetchAll()
    ]);

    // Validamos errores de los catálogos directos
    if (groupsRes.error) throw groupsRes.error;
    if (categoriesRes.error) throw categoriesRes.error;
    if (typesRes.error) throw typesRes.error;

    const accountGroups = groupsRes.data || [];
    const accountCategories = categoriesRes.data || [];
    const transactionTypes = typesRes.data || [];

    console.log("⚡ ¡Ráfaga exitosa! Datos sincronizados en paralelo.");

    set({
      accountGroups: accountGroups as any[],
      accountCategories: accountCategories as any[],
      transactionTypes: transactionTypes as any[],
      transactions,
      accounts
    });
    
    console.log("🎉 ¡ÉXITO TOTAL! Todo el Store se actualizó correctamente tras el F5.");
  } catch (err) {
    console.error('🔥 Error real atrapado en las consultas del Store:', err);
  } finally {
    set({ isFetching: false });
  }
};

export const useFinanzasStore = create<FinanzasStoreContextType>((set, get) => {
  return {
    ...initialState,

    setProfile: (profile) => set({ profile }),

    fetchInitialData: () => fetchInitialDataLogic(set, get),

    // 2. OPERACIONES DE MOVIMIENTOS DESACOPLADAS
    addTransaction: async (transaction: Omit<Transaction, 'id' | 'created_at'>) => {
      try {
        const supabase = createClientSupabaseClient();
        const supabaseTransactionRepository = new SupabaseTransactionRepository(supabase);
        await supabaseTransactionRepository.save(transaction);
        await get().fetchInitialData();
      } catch (err) {
        console.error('Error al delegar inserción de transacción:', err);
      }
    },
  
    deleteTransaction: async (id: string) => {
      try {
        const supabase = createClientSupabaseClient();
        const supabaseTransactionRepository = new SupabaseTransactionRepository(supabase);
        await supabaseTransactionRepository.delete(id);
        await get().fetchInitialData();
      } catch (err) {
        console.error('Error al delegar eliminación de transacción:', err);
      }
    },

    // 3. OPERACIONES DE CUENTAS DESACOPLADAS
    addAccount: async (nuevaCuenta) => {
      try {
        const supabase = createClientSupabaseClient();
        const supabaseAccountRepository = new SupabaseAccountRepository(supabase);
        await supabaseAccountRepository.save(nuevaCuenta);
        await get().fetchInitialData();
      } catch (err) {
        console.error('Error al delegar creación de cuenta:', err);
      }
    },

    updateAccount: async (cuentaModificada) => {
      try {
        const supabase = createClientSupabaseClient();
        const supabaseAccountRepository = new SupabaseAccountRepository(supabase);
        await supabaseAccountRepository.update(cuentaModificada);
        await get().fetchInitialData();
      } catch (err) {
        console.error('Error al delegar actualización de cuenta:', err);
      }
    },

    deleteAccount: async (id) => {
      try {
        const supabase = createClientSupabaseClient();
        const supabaseAccountRepository = new SupabaseAccountRepository(supabase);
        await supabaseAccountRepository.delete(id);
        await get().fetchInitialData();
      } catch (err) {
        console.error('Error al delegar eliminación de cuenta:', err);
      }
    },

    // 4. MANTENIMIENTO DE ESTRUCTURAS SECUNDARIAS
    addAccountGroup: async (name: string) => {
      try {
        const supabase = createClientSupabaseClient();
        const supabaseCatalogRepository = new SupabaseCatalogRepository(supabase);
        await supabaseCatalogRepository.addGroup(name);
        await get().fetchInitialData();
      } catch (error) {
        console.error(error);
      }
    },

    updateAccountGroup: async (id: string, newName: string) => {
      try {
        const supabase = createClientSupabaseClient();
        const supabaseCatalogRepository = new SupabaseCatalogRepository(supabase);
        await supabaseCatalogRepository.updateGroup(id, newName);
        await get().fetchInitialData();
      } catch (error) {
        console.error(error);
      }
    },

    deleteAccountGroup: async (name: string) => {
      try {
        const supabase = createClientSupabaseClient();
        const supabaseCatalogRepository = new SupabaseCatalogRepository(supabase);
        await supabaseCatalogRepository.deleteGroup(name);
        await get().fetchInitialData();
      } catch (error) {
        console.error(error);
      }
    },

    addAccountCategory: async (name: string) => {
      try {
        const supabase = createClientSupabaseClient();
        const supabaseCatalogRepository = new SupabaseCatalogRepository(supabase);
        await supabaseCatalogRepository.addCategory(name);
        await get().fetchInitialData();
      } catch (error) {
        console.error(error);
      }
    },

    updateAccountCategory: async (id: string, newName: string) => {
      try {
        const supabase = createClientSupabaseClient();
        const supabaseCatalogRepository = new SupabaseCatalogRepository(supabase);
        await supabaseCatalogRepository.updateCategory(id, newName);
        await get().fetchInitialData();
      } catch (error) {
        console.error(error);
      }
    },

    deleteAccountCategory: async (name: string) => {
      try {
        const supabase = createClientSupabaseClient();
        const supabaseCatalogRepository = new SupabaseCatalogRepository(supabase);
        await supabaseCatalogRepository.deleteCategory(name);
        await get().fetchInitialData();
      } catch (error) {
        console.error(error);
      }
    },

    // 5. INTELIGENCIA CONTABLE BILINGÜE INTEGRADORA
    getAccountBalance: (accountId) => {
      const cuenta = get().accounts.find((a) => a.id === accountId);
      if (!cuenta) return 0;
      
      const balance = get().transactions
        .filter((t) => t.cuentaId === accountId)
        .reduce((acc, t) => {
          const tipoEncontrado = get().transactionTypes.find(
            (tt) => tt.id === t.transaction_type_id || tt.id === (t as any).typeId
          );
          
          const nombreTipo = tipoEncontrado?.name?.toLowerCase().trim() || '';
          const codigoTipo = tipoEncontrado?.code?.toLowerCase().trim() || '';
          const montoAbs = Math.abs(t.monto);

          if (nombreTipo === 'ingreso' || codigoTipo === 'income') {
            return acc + montoAbs;
          } else if (nombreTipo === 'egreso' || codigoTipo === 'expense') {
            return acc - montoAbs;
          } else {
            return t.monto < 0 ? acc - montoAbs : acc + t.monto;
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
    }
  };
});