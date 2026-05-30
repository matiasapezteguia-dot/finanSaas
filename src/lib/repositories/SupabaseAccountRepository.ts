import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { Account, IAccountRepository, AccountGroup, AccountCategory, MonedaType } from '../../types/finanzas';
import { Database } from '../../types/supabase_types';

type AccountRow = Database['public']['Tables']['accounts']['Row'];
type AccountInsert = Database['public']['Tables']['accounts']['Insert'];
type AccountUpdate = Database['public']['Tables']['accounts']['Update'];
type AccountGroupRow = Database['public']['Tables']['account_groups']['Row'];
type AccountCategoryRow = Database['public']['Tables']['account_categories']['Row'];

type AccountWithRelations = AccountRow & {
  account_groups: Pick<AccountGroupRow, 'name'> | null;
  account_categories: Pick<AccountCategoryRow, 'name'> | null;
};

export class SupabaseAccountRepository implements IAccountRepository {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  async fetchAll(): Promise<Account[]> {
    // CORREGIDO: Mapeo de select con los campos reales de la tabla física en PostgreSQL
    const { data, error } = await this.supabase
      .from('accounts')
      .select(`
        id,
        name,
        currency,
        initial_amount,
        created_at,
        account_groups (name),
        account_categories (name)
      `) as { data: AccountWithRelations[] | null; error: Error | null };

    if (error) {
      console.error('Error fetching accounts:', error);
      throw error;
    }

    if (!data) {
      return [];
    }

    // Traduce de la infraestructura física (inglés/snake_case) al dominio local de la UI
    return data.map((item: AccountWithRelations) => ({
      id: item.id,
      nombre: item.name,
      grupo: item.account_groups?.name ?? null,
      categoria: item.account_categories?.name ?? null,
      moneda: item.currency as MonedaType,
      montoInicial: Number(item.initial_amount) || 0,
      created_at: item.created_at,
    }));
  }

  async save(account: Omit<Account, 'id' | 'created_at'>): Promise<Account> {
    const newId = uuidv4();
    let groupId: string | null = null;
    let categoryId: string | null = null;

    if (account.grupo) {
      const { data: groupData, error: groupError } = await this.supabase
        .from('account_groups')
        .select('id')
        .eq('name', account.grupo)
        .maybeSingle<Pick<AccountGroupRow, 'id'> | null>();

      if (groupError) {
        console.error('Error fetching account group:', groupError);
        throw groupError;
      }
      groupId = groupData?.id ?? null;
    }

    if (account.categoria) {
      const { data: categoryData, error: categoryError } = await this.supabase
        .from('account_categories')
        .select('id')
        .eq('name', account.categoria)
        .maybeSingle<Pick<AccountCategoryRow, 'id'> | null>();

      if (categoryError) {
        console.error('Error fetching account category:', categoryError);
        throw categoryError;
      }
      categoryId = categoryData?.id ?? null;
    }

    const accountToInsert: AccountInsert = {
      id: newId,
      name: account.nombre,
      account_group_id: groupId,
      account_category_id: categoryId,
      currency: account.moneda,
      initial_amount: Number(account.montoInicial) || 0,
      current_amount: Number(account.montoInicial) || 0,
    };

    const { data, error } = await this.supabase
      .from('accounts')
      .insert(accountToInsert)
      .select()
      .single<AccountRow>();

    if (error) {
      console.error('Error saving account:', error);
      throw error;
    }

    return {
      id: data.id,
      nombre: data.name,
      grupo: account.grupo,
      categoria: account.categoria,
      moneda: data.currency as MonedaType,
      montoInicial: Number(data.initial_amount) || 0,
      created_at: data.created_at
    };
  }

  async update(account: Account): Promise<void> {
    let groupId: string | null = null;
    let categoryId: string | null = null;

    if (account.grupo) {
      const { data: groupData, error: groupError } = await this.supabase
        .from('account_groups')
        .select('id')
        .eq('name', account.grupo)
        .maybeSingle<Pick<AccountGroupRow, 'id'> | null>();

      if (groupError) {
        console.error('Error fetching account group:', groupError);
        throw groupError;
      }
      groupId = groupData?.id ?? null;
    }

    if (account.categoria) {
      const { data: categoryData, error: categoryError } = await this.supabase
        .from('account_categories')
        .select('id')
        .eq('name', account.categoria)
        .maybeSingle<Pick<AccountCategoryRow, 'id'> | null>();

      if (categoryError) {
        console.error('Error fetching account category:', categoryError);
        throw categoryError;
      }
      categoryId = categoryData?.id ?? null;
    }

    const accountToUpdate: AccountUpdate = {
      name: account.nombre,
      account_group_id: groupId,
      account_category_id: categoryId,
      currency: account.moneda,
      initial_amount: Number(account.montoInicial) || 0,
    };

    const { error } = await this.supabase
      .from('accounts')
      .update(accountToUpdate)
      .eq('id', account.id);

    if (error) {
      console.error('Error updating account:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('accounts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  }
}

