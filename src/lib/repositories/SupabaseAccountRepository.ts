import { SupabaseClient } from '@supabase/supabase-js';
import { Account, MonedaType } from '../../types/finanzas';
import { Database } from '../../types/supabase_types';

type AccountRow = Database['public']['Tables']['accounts']['Row'];
type AccountInsert = Database['public']['Tables']['accounts']['Insert'];
type AccountUpdate = Database['public']['Tables']['accounts']['Update'];

export class SupabaseAccountRepository {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

// Trae los registros físicos directos de la base de datos
  async fetchAllRaw(): Promise<AccountRow[]> {
    const { data, error } = await this.supabase
      .from('accounts')
      // 🔑 SOLUCIÓN: Removimos 'user_id' de la cadena para que Supabase no tire SelectQueryError
      .select('id, name, currency, initial_amount, account_group_id, account_category_id, created_at, deleted_at')
      .is('deleted_at', null);

    if (error) {
      console.error('🔥 Error en Repositorio al buscar cuentas:', error);
      throw error;
    }

    // El tipo de 'data' ahora se infiere correctamente sin errores
    const processedData: AccountRow[] = (data || []).map((item) => ({
      id: item.id,
      name: item.name,
      currency: item.currency,
      initial_amount: item.initial_amount,
      current_amount: item.initial_amount, 
      account_group_id: item.account_group_id,
      account_category_id: item.account_category_id,
      created_at: item.created_at,
      deleted_at: item.deleted_at,      
    }));

    return processedData;
  }

  async fetchAll(): Promise<Account[]> {
    const rawAccounts = await this.fetchAllRaw();
    return rawAccounts.map(row => ({
      id: row.id,
      nombre: row.name || '',
      account_group_id: row.account_group_id || '',
      account_category_id: row.account_category_id || '',
      moneda: (row.currency as MonedaType) || 'ARS',
      montoInicial: Number(row.initial_amount) || 0,
      current_amount: Number(row.initial_amount) || 0,
      user_id: null, 
      created_at: row.created_at,
      grupo: '', 
      categoria: '', 
    }));
  }

  // Guarda en la BD validando el contrato estricto de inserción
  async save(account: Omit<Account, 'id' | 'created_at' | 'grupo' | 'categoria'>): Promise<void> {
    const payload: AccountInsert = {
      name: account.nombre,
      currency: account.moneda,
      initial_amount: Number(account.montoInicial) || 0,
      current_amount: Number(account.montoInicial) || 0,
      account_group_id: account.account_group_id || null,
      account_category_id: account.account_category_id || null
    };

    const { error } = await this.supabase
      .from('accounts')
      .insert([payload]);

    if (error) {
      console.error('🔥 Error en Repositorio al insertar cuenta:', error);
      throw error;
    }
  }

  // Actualiza en la BD validando el contrato estricto de modificación
  async update(id: string, account: Omit<Account, 'id' | 'created_at' | 'grupo' | 'categoria'>): Promise<void> {
    const payload: AccountUpdate = {
      name: account.nombre,
      currency: account.moneda,
      initial_amount: Number(account.montoInicial) || 0,
      account_group_id: account.account_group_id || null,
      account_category_id: account.account_category_id || null
    };

    const { error } = await this.supabase
      .from('accounts')
      .update(payload)
      .eq('id', id);

    if (error) {
      console.error('🔥 Error en Repositorio al actualizar cuenta:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('accounts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('🔥 Error en Repositorio al eliminar cuenta:', error);
      throw error;
    }
  }

  // 🔑 Nota los dos puntos ':' antes de Promise. Evita que se confunda con un operador matemático.
  async softDelete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('accounts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('🔥 Error en Repositorio al aplicar softDelete en cuenta:', error);
      throw error;
    }
  }
}



