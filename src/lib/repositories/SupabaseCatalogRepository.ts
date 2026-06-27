import { ICatalogRepository, AccountCategory, MovementTypeItem, AccountGroup } from '../../types/finanzas';
import { Database } from '../../types/supabase_types';
import { SupabaseClient } from '@supabase/supabase-js';

type GroupInsert = Database['public']['Tables']['account_groups']['Insert'];
type GroupUpdate = Database['public']['Tables']['account_groups']['Update'];
type CategoryInsert = Database['public']['Tables']['account_categories']['Insert'];
type CategoryUpdate = Database['public']['Tables']['account_categories']['Update'];

export class SupabaseCatalogRepository implements ICatalogRepository {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  async fetchGroups(): Promise<AccountGroup[]> {
    const { data, error } = await this.supabase
      .from('account_groups')
      .select('id, name')
      .is('deleted_at', null);

    if (error) {
      console.error('Error fetching groups:', error);
      throw new Error(error.message);
    }

    return (data || []).map(row => ({
      id: row.id,
      name: row.name || ''
    }));
  }

  async fetchCategories(): Promise<AccountCategory[]> {
    const { data, error } = await this.supabase
      .from('account_categories')
      .select('id, name')
      .is('deleted_at', null);

    if (error) {
      console.error('Error fetching categories:', error);
      throw new Error(error.message);
    }

    return (data || []).map(row => ({
      id: row.id,
      name: row.name || ''
    }));
  }

  async fetchTransactionTypes(): Promise<MovementTypeItem[]> {
    const { data, error } = await this.supabase
      .from('transaction_types')
      .select('id, name, code');

    if (error) {
      console.error('Error fetching transaction types:', error);
      throw new Error(error.message);
    }

    return (data || []).map(row => ({
      id: row.id,
      name: row.name || '',
      code: row.code || ''
    }));
  }

  async addCategory(name: string): Promise<void> {
    const payload: CategoryInsert = { name };

    const { error } = await this.supabase
      .from('account_categories')
      .insert([payload]);

    if (error) {
      console.error('Error adding category:', error);
      throw new Error(error.message);
    }
  }

  async deleteCategory(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('account_categories')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting category:', error);
      throw new Error(error.message);
    }
  }

  async addGroup(name: string): Promise<void> {
    const payload: GroupInsert = { name };

    const { error } = await this.supabase
      .from('account_groups')
      .insert([payload]);

    if (error) {
      console.error('Error adding group:', error);
      throw new Error(error.message);
    }
  }

  async deleteGroup(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('account_groups')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting group:', error);
      throw new Error(error.message);
    }
  }

  async updateGroup(id: string, newName: string): Promise<void> {
    const payload: GroupUpdate = { name: newName };

    const { error } = await this.supabase
      .from('account_groups')
      .update(payload)
      .eq('id', id);

    if (error) {
      console.error('Error updating group:', error);
      throw new Error(error.message);
    }
  }

  async updateCategory(id: string, newName: string): Promise<void> {
    const payload: CategoryUpdate = { name: newName };

    const { error } = await this.supabase
      .from('account_categories')
      .update(payload)
      .eq('id', id);

    if (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  }

  async softDeleteGroup(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('account_groups')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('🔥 Error en Repositorio al aplicar softDelete en grupo:', error);
      throw new Error(error.message);
    }
  }

  async softDeleteCategory(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('account_categories')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('🔥 Error en Repositorio al aplicar softDelete en categoría:', error);
      throw new Error(error.message);
    }
  }
}

