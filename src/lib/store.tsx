import { create, StoreApi } from 'zustand';
import { Account, Transaction, StoreState, AccountCategory, FinanzasStoreContextType, MonedaType } from '../types/finanzas';
// 🔑 Conectamos tu store con el archivo único que me pasaste recién
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

    // 🚀 BYPASS COMPLETO: Consultas directas por tu cliente único de Supabase
    const [
      groupsRes,
      categoriesRes,
      typesRes,
      transactionsRes,
      accountsRes
    ] = await Promise.all([
      supabase.from('account_groups').select('id, name'),
      supabase.from('account_categories').select('id, name'),
      supabase.from('transaction_types').select('id, name, code'),
      supabase.from('transactions').select('*'), 
      supabase.from('accounts').select('id, created_at, name, currency, initial_amount, current_amount, account_group_id, account_category_id')
    ]);

    // Validamos errores de las consultas directas
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

    // 🔄 HIDRATACIÓN EN CALIENTE HÍBRIDA
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
        
        // IDs reales para persistencia limpia
        account_group_id: acc.account_group_id || '',
        account_category_id: acc.account_category_id || '',
        
        // Campos calculados virtuales de compatibilidad para el Dashboard antiguo
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
  return {
    ...initialState,

    setProfile: (profile) => set({ profile }),

    fetchInitialData: () => fetchInitialDataLogic(set, get),

    // =========================================================================
    // 📊 OPERACIONES DE MOVIMIENTOS OPTIMIZADAS
    // =========================================================================
    addTransaction: async (transaction: Omit<Transaction, 'id' | 'created_at'>) => {
      try {
        console.log("📝 Insertando transacción de forma directa...");
        const { error } = await supabase
          .from('transactions')
          .insert([{
            date: transaction.date,
            description: transaction.description,
            amount: transaction.amount,
            currency: transaction.currency,
            account_id: (transaction as any).account_id || (transaction as any).cuentaId,
            transaction_type_id: transaction.transaction_type_id
          }]);

        if (error) throw error;
        await get().fetchInitialData();
      } catch (err) {
        console.error('🔥 Error al insertar transacción:', err);
      }
    },
  
    deleteTransaction: async (id: string) => {
      try {
        // 1. ACTUALIZACIÓN OPTIMISTA: Borramos de la pantalla YA mismo
        const transaccionesPrevias = get().transactions;
        const transaccionesFiltradas = transaccionesPrevias.filter(t => t.id !== id);
        
        console.log(`✨ OPTIMISTIC: Removiendo transacción ${id} de la pantalla de inmediato.`);
        set({ transactions: transaccionesFiltradas });

        // 2. Mandamos la orden a tu Supabase global sin bloquear con await
        console.log(`🗑️ BASE DE DATOS: Ejecutando borrado asincrónico para ID: ${id}`);
        
        supabase
          .from('transactions')
          .delete()
          .eq('id', id)
          .then(({ error }) => {
            if (error) {
              console.error("❌ Error diferido al borrar en Supabase:", error);
              // Si falla, revertimos el estado local
              set({ transactions: transaccionesPrevias });
            } else {
              console.log("✅ Servidor confirmó la eliminación con éxito.");
              get().fetchInitialData();
            }
          });
      } catch (err) {
        console.error('🔥 Error crítico al delegar eliminación de transacción:', err);
      }
    },

    // =========================================================================
    // 💳 OPERACIONES DE CUENTAS ENCAPSULADAS
    // =========================================================================
    addAccount: async (nuevaCuenta) => {
      try {
        console.log("📝 Insertando cuenta de forma directa usando IDs limpios:", nuevaCuenta);

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
        console.log("✅ Cuenta guardada exitosamente.");
        await get().fetchInitialData();
      } catch (err) {
        console.error('🔥 Error al insertar cuenta mapeada:', err);
      }
    },

    updateAccount: async (cuentaModificada) => {
      try {
        console.log(`📝 Actualizando cuenta ID de forma directa: ${cuentaModificada.id}`);

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
        console.log("✅ Cuenta actualizada exitosamente.");
        await get().fetchInitialData();
      } catch (err) {
        console.error('🔥 Error al actualizar cuenta mapeada:', err);
      }
    },

    deleteAccount: async (id: string) => {
      try {
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

    // =========================================================================
    // 📁 MANTENIMIENTO DE ESTRUCTURAS SECUNDARIAS
    // =========================================================================
    addAccountGroup: async (name: string) => {
      try {
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

    // =========================================================================
    // 🧠 INTELIGENCIA CONTABLE INTEGRADORA
    // =========================================================================
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