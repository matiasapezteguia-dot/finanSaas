import { ICatalogRepository, AccountCategory, MovementTypeItem } from '../../types/finanzas';
import { Database } from '../../types/supabase_types';
import { SupabaseClient } from '@supabase/supabase-js';

export class SupabaseCatalogRepository implements ICatalogRepository {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }
  async fetchGroups(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('account_groups')
      .select('name');

    if (error) {
      console.error('Error fetching groups:', error);
      throw new Error(error.message);
    }

    return data.map((group: Pick<Database['public']['Tables']['account_groups']['Row'], 'name'>) => group.name);
  }

  async fetchCategories(): Promise<AccountCategory[]> {
    const { data, error } = await this.supabase
      .from('account_categories')
      .select('id, name'); // CORREGIDO: Eliminado 'created_at' que causaba el quiebre

    if (error) {
      console.error('Error fetching categories:', error);
      throw new Error(error.message);
    }

    return data as Database['public']['Tables']['account_categories']['Row'][];
  }

  async fetchTransactionTypes(): Promise<MovementTypeItem[]> {
    const { data, error } = await this.supabase
      .from('transaction_types')
      .select('id, name, code');

    if (error) {
      console.error('Error fetching transaction types:', error);
      throw new Error(error.message);
    }

    return data as MovementTypeItem[];
  }

  async addCategory(name: string): Promise<void> {
    const { error } = await this.supabase
      .from('account_categories')
      .insert([{ name }]);

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
    const { error } = await this.supabase
      .from('account_groups')
      .insert([{ name }]);

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
  async updateGroup(oldName: string, newName: string): Promise<void> {
    const { error } = await this.supabase
      .from('account_groups')
      .update({ name: newName })
      .eq('name', oldName);

    if (error) {
      console.error('Error updating group:', error);
      throw new Error(error.message);
    }
  }

  async updateCategory(oldName: string, newName: string): Promise<void> {
    const { error } = await this.supabase
      .from('account_categories')
      .update({ name: newName })
      .eq('name', oldName);

    if (error) {
      console.error('Error updating category:', error);
      throw new Error(error.message);
    }
  }
}

