import { SupabaseClient } from '@supabase/supabase-js';
import { Account, MonedaType } from '../../types/finanzas';
import { Database } from '../../types/supabase_types';

type AccountRow = Database['public']['Tables']['accounts']['Row'];

export class SupabaseAccountRepository {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  // Trae los registros físicos directos de la base de datos
  async fetchAllRaw(): Promise<AccountRow[]> {
    const { data, error } = await this.supabase
      .from('accounts')
      .select('id, name, currency, initial_amount, user_id, account_group_id, account_category_id, created_at');

    if (error) {
      console.error('🔥 Error en Repositorio al buscar cuentas:', error);
      throw error;
    }
    const processedData = (data || []).map(item => ({
      ...item,
      current_amount: item.initial_amount, // Inyectar el valor calculado
      user_id: item.user_id || null, // Asegurar que sea null si no existe
    }));
    return processedData as AccountRow[];
  }

  async fetchAll(): Promise<Account[]> {
    const rawAccounts = await this.fetchAllRaw();
    return rawAccounts.map(row => ({
      id: row.id,
      nombre: row.name,
      account_group_id: row.account_group_id || '', // Asegurar que no sea null
      account_category_id: row.account_category_id || '', // Asegurar que no sea null
      moneda: row.currency as MonedaType,
      montoInicial: row.initial_amount,
      current_amount: row.initial_amount, // Calculado en el frontend
      user_id: row.user_id, // Ya es string | null
      created_at: row.created_at,
      grupo: '', // Se rellena en el Store
      categoria: '', // Se rellena en el Store
    }));
  }

  // Guarda en la BD usando puramente los IDs relacionales que le envía el Store
  async save(account: Omit<Account, 'id' | 'created_at' | 'grupo' | 'categoria'>): Promise<void> {
    const { error } = await this.supabase
      .from('accounts')
      .insert([{
        name: account.nombre,
        currency: account.moneda,
        initial_amount: Number(account.montoInicial) || 0,
        current_amount: Number(account.montoInicial) || 0,
        account_group_id: account.account_group_id,
        account_category_id: account.account_category_id
      }]);

    if (error) {
      console.error('🔥 Error en Repositorio al insertar cuenta:', error);
      throw error;
    }
  }

  // Actualiza en la BD usando puramente los IDs relacionales que le envía el Store
  async update(id: string, account: Omit<Account, 'id' | 'created_at' | 'grupo' | 'categoria'>): Promise<void> {
    const { error } = await this.supabase
      .from('accounts')
      .update({
        name: account.nombre,
        currency: account.moneda,
        initial_amount: Number(account.montoInicial) || 0,
        account_group_id: account.account_group_id,
        account_category_id: account.account_category_id
      })
      .eq('id', id);

    if (error) {
      console.error('🔥 Error en Repositorio al actualizar cuenta:', error);
      throw error;
    }
  }

  // Elimina por ID primario
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
}