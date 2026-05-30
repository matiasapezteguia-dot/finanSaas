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

// Define fetchInitialData as a standalone function to ensure stable reference
// This function will be called by the store action
const fetchInitialDataLogic = async (set: StoreApi<FinanzasStoreContextType>['setState'], get: StoreApi<FinanzasStoreContextType>['getState']) => {
  // Si ya hay una petición en curso salimos inmediatamente para no encimar conexiones
  if (get().isFetching) {
    console.log("🛑 ESCUDO: fetchInitialData ya está corriendo, abortando llamada duplicada.");
    return;
  }
  
  // Activamos el bloqueo
  set({ isFetching: true });

  try {
    const supabase = createClientSupabaseClient();

    const supabaseTransactionRepository = new SupabaseTransactionRepository(supabase);
    const supabaseAccountRepository = new SupabaseAccountRepository(supabase);
    const supabaseCatalogRepository = new SupabaseCatalogRepository(supabase);

    console.log("🕵️‍♂️ DETECTOR: Iniciando desguace de consultas a Supabase...");

    // ==========================================
    // BYPASS TOTAL DE CATÁLOGOS PARA EVITAR TRABAS INFLEXIBLES
    // ==========================================
    console.log("⏳ Paso A: [BYPASS DESACTIVADO] Consultando grupos de cuentas...");
    const accountGroups = await supabaseCatalogRepository.fetchGroups();
    console.log("✅ Paso A Exitoso. Grupos listos.");

    console.log("⏳ Paso B: [BYPASS DESACTIVADO] Consultando categorías de cuentas...");
    const accountCategories = await supabaseCatalogRepository.fetchCategories();
    console.log("✅ Paso B Exitoso. Categorías listas.");

    console.log("⏳ Paso C: [BYPASS DESACTIVADO] Consultando tipos de transacciones...");
    const transactionTypes = await supabaseCatalogRepository.fetchTransactionTypes();
    console.log("✅ Paso C Exitoso. Tipos listos.");
    // ==========================================

    console.log("⏳ Paso D: [BYPASS DESACTIVADO] Consultando transacciones...");
    const transactions = await supabaseTransactionRepository.fetchAll();
    console.log("✅ Paso D Exitoso. Transacciones listas.");

    console.log("⏳ Paso E: [BYPASS DESACTIVADO] Consultando cuentas...");
    const accounts = await supabaseAccountRepository.fetchAll();
    console.log("✅ Paso E Exitoso. Cuentas listas.");

    set({
      accountGroups,
      accountCategories,
      transactionTypes,
      transactions,
      accounts
    });
    
    console.log("🎉 ¡ÉXITO TOTAL! Todo el Store se actualizó correctamente.");

  } catch (err) {
    console.error('🔥 Error en la orquestación de datos del Store:', err);
  } finally {
    set({ isFetching: false }); // Liberamos el freno de mano
  }
};

export const useFinanzasStore = create<FinanzasStoreContextType>((set, get) => {
  return {
    ...initialState,

    setProfile: (profile) => set({ profile }),

    // 1. CARGA DE DATOS DESARMADA PASO A PASO PARA DETECTAR CONGELAMIENTO
    fetchInitialData: () => fetchInitialDataLogic(set, get),

    // 2. OPERACIONES DE MOVIMIENTOS DESACOPLADAS
    addTransaction: async (transaction: Omit<Transaction, 'id' | 'created_at'>) => {
      try {
        const supabase = createClientSupabaseClient();
        const supabaseTransactionRepository = new SupabaseTransactionRepository(supabase);
        await supabaseTransactionRepository.save(transaction);
        await get().fetchInitialData(); // Sincroniza estado local automáticamente
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

    // 5. INTELIGENCIA CONTABLE BILINGÜE INTEGRADORA (Inmune a fallos)
    getAccountBalance: (accountId) => {
      const cuenta = get().accounts.find((a) => a.id === accountId);
      if (!cuenta) return 0;
      
      const balance = get().transactions
        .filter((t) => t.cuentaId === accountId)
        .reduce((acc, t) => {
          // 1. Buscar el tipo de transacción en el catálogo usando el ID real de la base de datos
          const tipoEncontrado = get().transactionTypes.find(
            (tt) => tt.id === t.transaction_type_id || tt.id === (t as any).typeId
          );
          
          // 2. Obtener el nombre o código para saber qué es
          const nombreTipo = tipoEncontrado?.name?.toLowerCase().trim() || '';
          const codigoTipo = tipoEncontrado?.code?.toLowerCase().trim() || '';
          
          const montoAbs = Math.abs(t.monto);

          // 3. Evaluar con precisión quirúrgica
          if (nombreTipo === 'ingreso' || codigoTipo === 'income') {
            return acc + montoAbs;
          } else if (nombreTipo === 'egreso' || codigoTipo === 'expense') {
            return acc - montoAbs;
          } else {
            // Salvavidas final por si el monto vino explícitamente negativo
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
