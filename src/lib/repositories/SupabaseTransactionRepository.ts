import { ITransactionRepository, Transaction, MovementCodeType, MonedaType } from '../../types/finanzas';
import { Database } from '../../types/supabase_types';
import { SupabaseClient } from '@supabase/supabase-js';

type SupabaseTransactionRow = Database['public']['Tables']['transactions']['Row'];
type SupabaseTransactionInsert = Database['public']['Tables']['transactions']['Insert'];
type SupabaseTransactionUpdate = Database['public']['Tables']['transactions']['Update'];

export class SupabaseTransactionRepository implements ITransactionRepository {
  private supabase: SupabaseClient<Database>;
  private readonly TABLE_NAME = 'transactions';

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  // Helper estricto para validar si una cadena tiene estructura de UUID
  private isUUID(str: string | null | undefined): boolean {
    if (!str) return false;
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str);
  }

  private toSupabase(
    transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'transaction_type_code'>
  ): Omit<SupabaseTransactionInsert, 'id' | 'created_at' | 'updated_at'> {
    return {
      account_id: transaction.account_id,
      amount: transaction.amount,
      description: transaction.description,
      transaction_date: transaction.transaction_date,
      currency: transaction.moneda, // 🔑 CAMBIO: Cambiamos la propiedad clave a 'currency'
      transaction_type_id: transaction.transaction_type_id,
      category_id: this.isUUID(transaction.category_id) ? transaction.category_id : null,
      related_transaction_id: transaction.related_transaction_id,
      is_voided: transaction.is_voided,
    } as any; // 🔑 Agregamos 'as any' para evitar colisiones con el archivo de tipos viejo mientras probás
  }

  private fromSupabase(supabaseTransaction: SupabaseTransactionRow): Transaction {
    return {
      id: supabaseTransaction.id!,
      account_id: supabaseTransaction.account_id!,
      amount: supabaseTransaction.amount!,
      description: supabaseTransaction.description!,
      transaction_date: supabaseTransaction.transaction_date!,
      moneda: supabaseTransaction.currency as MonedaType,
      transaction_type_id: supabaseTransaction.transaction_type_id!,
      category_id: supabaseTransaction.category_id,
      related_transaction_id: supabaseTransaction.related_transaction_id,
      is_voided: supabaseTransaction.is_voided || false,
      created_at: supabaseTransaction.created_at,
      updated_at: supabaseTransaction.created_at,
      deleted_at: supabaseTransaction.deleted_at,
    };
  }

  async fetchAll(): Promise<Transaction[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.TABLE_NAME)
        .select('*');

      if (error) {
        console.error('Error fetching transactions:', error);
        throw new Error(`Error fetching transactions: ${error.message}`);
      }

      // CORREGIDO: Se añade .bind(this) para que no falle el contexto en la iteración
      return (data as SupabaseTransactionRow[]).map(this.fromSupabase.bind(this));
    } catch (err) {
      console.error('Unhandled error in fetchAll transactions:', err);
      throw err;
    }
  }

  async save(transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>): Promise<void> {
    const supabaseData = this.toSupabase(transaction);
    const { error } = await this.supabase
      .from(this.TABLE_NAME)
      .insert(supabaseData as SupabaseTransactionInsert);

    if (error) {
      throw new Error(`Error saving transaction: ${error.message}`);
    }
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.TABLE_NAME)
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting transaction: ${error.message}`);
    }
  }
}