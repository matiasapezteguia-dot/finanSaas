import { create, StoreApi } from 'zustand';
import { Account, Transaction, StoreState, AccountCategory, FinanzasStoreContextType, MonedaType } from '../types/finanzas';
import { createClientSupabaseClient } from '../utils/supabase/client';
import { SupabaseTransactionRepository } from './repositories/SupabaseTransactionRepository';

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
  
  set({ isFetching: true });

  try {
    const supabaseTransactionRepository = new SupabaseTransactionRepository(globalSupabase);

    console.log("🕵️‍♂️ DETECTOR: Iniciando ráfaga paralela de alta velocidad hacia Supabase...");

    // Disparamos las 5 consultas en simultáneo directo por el mismo caño sin repositorios rotos
    const [
      groupsRes,
      categoriesRes,
      typesRes,
      transactions,
      accountsRes
    ] = await Promise.all([
      globalSupabase.from('account_groups').select('id, name'),
      globalSupabase.from('account_categories').select('id, name'),
      globalSupabase.from('transaction_types').select('id, name, code'),
      supabaseTransactionRepository.fetchAll(),
      globalSupabase.from('accounts').select('id, name, currency, initial_amount, account_group_id, account_category_id')
    ]);

    // Validamos errores de las consultas directas
    if (groupsRes.error) throw groupsRes.error;
    if (categoriesRes.error) throw categoriesRes.error;
    if (typesRes.error) throw typesRes.error;
    if (accountsRes.error) throw accountsRes.error;

    const accountGroups = groupsRes.data || [];
    const accountCategories = categoriesRes.data || [];
    const transactionTypes = typesRes.data || [];
    const rawAccounts = accountsRes.data || [];

    console.log("⚡ ¡Ráfaga exitosa! Datos base sincronizados.");

    // 🔄 HIDRATACIÓN EN CALIENTE HÍBRIDA: Inyectamos los IDs reales para la lógica y resolvemos los nombres legibles para la UI antigua
    const mappedAccounts: Account[] = rawAccounts.map((acc) => {
      const grupoObj = accountGroups.find(g => g.id === acc.account_group_id);
      const catObj = accountCategories.find(c => c.id === acc.account_category_id);

      return {
        id: acc.id,
        nombre: acc.name || 'Sin Nombre',
        moneda: (acc.currency as 'ARS' | 'USD') || 'ARS',
        montoInicial: Number(acc.initial_amount) || 0,
        
        // 🔑 IDs reales para persistencia limpia y encapsulada
        account_group_id: acc.account_group_id || '',
        account_category_id: acc.account_category_id || '',
        
        // 🔄 Campos calculados virtuales de compatibilidad (evitan romper el Dashboard)
        grupo: grupoObj ? grupoObj.name : 'Otros',
        categoria: catObj ? catObj.name : 'Sin Categoría'
      };
    });

    set({
      accountGroups: accountGroups as any[],
      accountCategories: accountCategories as any[],
      transactionTypes: transactionTypes as any[],
      transactions: transactions || [],
      accounts: mappedAccounts
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

    // 3. OPERACIONES DE CUENTAS ENCAPSULADAS (Puras, limpias y basadas en IDs)
    addAccount: async (nuevaCuenta) => {
      try {
        const supabase = createClientSupabaseClient();
        console.log("📝 Insertando cuenta de forma directa usando IDs limpios:", nuevaCuenta);

        // 🚀 ELIMINADAS LAS BÚSQUEDAS POR TEXTO: Los datos ya llegan con los IDs desde el componente visual
        const { error } = await supabase
          .from('accounts')
          .insert([{
            name: nuevaCuenta.nombre,
            currency: nuevaCuenta.moneda,
            initial_amount: nuevaCuenta.montoInicial,
            current_amount: nuevaCuenta.montoInicial,
            account_group_id: nuevaCuenta.account_group_id,     // ID directo
            account_category_id: nuevaCuenta.account_category_id // ID directo
          }]);

        if (error) throw error;
        console.log("✅ Cuenta guardada exitosamente.");
        await get().fetchInitialData();
      } catch (err) {
        console.error('🔥 Error al insertar cuenta mapeada:', err);
      }
    },

    updateAccount: async (cuentaModificada) => {
      try {
        const supabase = createClientSupabaseClient();
        console.log(`📝 Actualizando cuenta ID de forma directa usando IDs limpios: ${cuentaModificada.id}`);

        // 🚀 ELIMINADAS LAS BÚSQUEDAS POR TEXTO: Modificación directa e inmediata
        const { error } = await supabase
          .from('accounts')
          .update({
            name: cuentaModificada.nombre,
            currency: cuentaModificada.moneda,
            initial_amount: cuentaModificada.montoInicial,
            account_group_id: cuentaModificada.account_group_id,     // ID directo
            account_category_id: cuentaModificada.account_category_id // ID directo
          })
          .eq('id', cuentaModificada.id);

        if (error) throw error;
        console.log("✅ Cuenta actualizada exitosamente.");
        await get().fetchInitialData();
      } catch (err) {
        console.error('🔥 Error al actualizar cuenta mapeada:', err);
      }
    },

    deleteAccount: async (id: string) => {
      try {
        const supabase = createClientSupabaseClient();
        console.log(`🗑️ Eliminando cuenta ID: ${id}`);
        
        const { error } = await supabase
          .from('accounts')
          .delete()
          .eq('id', id);

        if (error) throw error;
        console.log("✅ Cuenta eliminada con éxito.");
        await get().fetchInitialData();
      } catch (err) {
        console.error('🔥 Error al eliminar cuenta:', err);
      }
    },

    // 4. MANTENIMIENTO DE ESTRUCTURAS SECUNDARIAS (Bypass de Repositorio Roto)
    addAccountGroup: async (name: string) => {
      try {
        const supabase = createClientSupabaseClient();
        const { error } = await supabase
          .from('account_groups')
          .insert([{ name }]);
          
        if (error) throw error;
        await get().fetchInitialData();
      } catch (error) {
        console.error("🔥 Error directo al agregar grupo:", error);
      }
    },

    updateAccountGroup: async (id: string, newName: string) => {
      try {
        const supabase = createClientSupabaseClient();
        const { error } = await supabase
          .from('account_groups')
          .update({ name: newName })
          .eq('id', id);
          
        if (error) throw error;
        await get().fetchInitialData();
      } catch (error) {
        console.error("🔥 Error directo al actualizar grupo:", error);
      }
    },

    deleteAccountGroup: async (id: string) => {
      try {
        const supabase = createClientSupabaseClient();
        const { error } = await supabase
          .from('account_groups')
          .delete()
          .eq('id', id);
          
        if (error) throw error;
        await get().fetchInitialData();
      } catch (error) {
        console.error("🔥 Error directo al eliminar grupo:", error);
      }
    },

    addAccountCategory: async (name: string) => {
      try {
        const supabase = createClientSupabaseClient();
        const { error } = await supabase
          .from('account_categories')
          .insert([{ name }]);
          
        if (error) throw error;
        await get().fetchInitialData();
      } catch (error) {
        console.error("🔥 Error directo al agregar categoría:", error);
      }
    },

    updateAccountCategory: async (id: string, newName: string) => {
      try {
        const supabase = createClientSupabaseClient();
        const { error } = await supabase
          .from('account_categories')
          .update({ name: newName })
          .eq('id', id);
          
        if (error) throw error;
        await get().fetchInitialData();
      } catch (error) {
        console.error("🔥 Error directo al actualizar categoría:", error);
      }
    },

    deleteAccountCategory: async (id: string) => {
      try {
        const supabase = createClientSupabaseClient();
        const { error } = await supabase
          .from('account_categories')
          .delete()
          .eq('id', id);
          
        if (error) throw error;
        await get().fetchInitialData();
      } catch (error) {
        console.error("🔥 Error directo al eliminar categoría:", error);
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