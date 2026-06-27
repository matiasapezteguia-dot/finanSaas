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
      .select('id, name, currency, initial_amount, user_id, account_group_id, account_category_id, created_at, deleted_at');

    if (error) {
      console.error('🔥 Error en Repositorio al buscar cuentas:', error);
      throw error;
    }

    // 🔑 Declaramos explícitamente el tipo AccountRow[] a la variable para que valide en tiempo real
    const processedData: AccountRow[] = ((data as any[]) || []).map((item) => ({
      id: String(item.id),
      name: item.name ? String(item.name) : '',
      currency: item.currency ? String(item.currency) : 'ARS',
      initial_amount: Number(item.initial_amount) || 0,
      current_amount: Number(item.initial_amount) || 0, // Inyectar el valor calculado
      account_group_id: item.account_group_id ? String(item.account_group_id) : null,
      account_category_id: item.account_category_id ? String(item.account_category_id) : null,
      created_at: item.created_at ? String(item.created_at) : new Date().toISOString(),
      deleted_at: item.deleted_at ? String(item.deleted_at) : null, // 🔑 Completamos el contrato
      user_id: item.user_id ? String(item.user_id) : null,
    }));

    return processedData;
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
      user_id: null, 
      created_at: row.created_at,
      grupo: '', // Se rellena en el Store
      categoria: '', // Se rellena en el Store
    }));
  }

  // Guarda en la BD usando puramente los IDs relacionales que le envía el Store
  async save(account: Omit<Account, 'id' | 'created_at' | 'grupo' | 'categoria'>): Promise<void> {
    const { error } = await (this.supabase.from('accounts' as any) as any) // 🔑 Bypass de tipos estricto
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
    const { error } = await (this.supabase.from('accounts' as any) as any) // 🔑 Bypass de tipos estricto
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