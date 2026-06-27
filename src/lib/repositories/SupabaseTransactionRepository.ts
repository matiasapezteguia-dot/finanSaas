import { ITransactionRepository, Transaction, MonedaType } from '../../types/finanzas';
import { Database } from '../../types/supabase_types';
import { SupabaseClient } from '@supabase/supabase-js';

type SupabaseTransactionRow = Database['public']['Tables']['transactions']['Row'];
type SupabaseTransactionInsert = Database['public']['Tables']['transactions']['Insert'];

export class SupabaseTransactionRepository implements ITransactionRepository {
  private supabase: SupabaseClient<Database>;
  private readonly TABLE_NAME = 'transactions';

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  private isUUID(str: string | null | undefined): boolean {
    if (!str) return false;
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str);
  }

  // Ahora el retorno está fuertemente tipado según el esquema oficial
  private toSupabase(
    transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'transaction_type_code'>
  ): SupabaseTransactionInsert {
    return {
      account_id: transaction.account_id,
      amount: transaction.amount,
      description: transaction.description || null,
      transaction_date: transaction.transaction_date,
      currency: transaction.moneda, 
      transaction_type_id: transaction.transaction_type_id,
      category_id: this.isUUID(transaction.category_id) ? transaction.category_id : null,
      related_transaction_id: transaction.related_transaction_id || null,
      is_voided: transaction.is_voided,
    };
  }

private fromSupabase(supabaseTransaction: SupabaseTransactionRow): Transaction {
    return {
      id: supabaseTransaction.id,
      account_id: supabaseTransaction.account_id || '',
      amount: Number(supabaseTransaction.amount) || 0,
      description: supabaseTransaction.description || '',
      transaction_date: supabaseTransaction.transaction_date || '',
      moneda: (supabaseTransaction.currency as MonedaType) || 'ARS',
      transaction_type_id: supabaseTransaction.transaction_type_id || '',
      category_id: supabaseTransaction.category_id || '',      
      related_transaction_id: supabaseTransaction.related_transaction_id ?? null,
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
        .select('*')
        .is('deleted_at', null);

      if (error) {
        console.error('Error fetching transactions:', error);
        throw new Error(`Error fetching transactions: ${error.message}`);
      }

      return (data || []).map(this.fromSupabase.bind(this));
    } catch (err) {
      console.error('Unhandled error in fetchAll transactions:', err);
      throw err;
    }
  }

  async save(transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>): Promise<void> {
    const supabaseData = this.toSupabase(transaction);
    
    const { error } = await this.supabase
      .from(this.TABLE_NAME)
      .insert([supabaseData]); // El payload ya cumple al 100% el tipo contractual

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

  async voidTransaction(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.TABLE_NAME)
      .update({ is_voided: true })
      .eq('id', id);

    if (error) throw error;
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.TABLE_NAME)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  }

  async addTransfer(
    transferData: any, 
    sourceAccountName: string, 
    targetAccountName: string
  ): Promise<void> {
    // 1. Insertar Pierna de Salida (Outflow)
    const outflowPayload = {
      account_id: transferData.sourceAccountId,
      amount: -Math.abs(transferData.amount),
      description: transferData.description + ` (Transferencia a ${sourceAccountName})`,
      transaction_date: transferData.transactionDate,
      currency: transferData.currency,
      transaction_type_id: transferData.transactionTypeId,
      category_id: null,
      related_transaction_id: null,
    };

    const { data: outflowData, error: outflowError } = await this.supabase
      .from(this.TABLE_NAME)
      .insert([outflowPayload])
      .select('id')
      .single();

    if (outflowError) throw outflowError;
    const insertedOutflowId = outflowData.id;

    // 2. Insertar Pierna de Entrada (Inflow) vinculando la salida
    const inflowPayload = {
      account_id: transferData.targetAccountId,
      amount: Math.abs(transferData.amount),
      description: transferData.description + ` (Transferencia desde ${sourceAccountName})`,
      transaction_date: transferData.transactionDate,
      currency: transferData.currency,
      transaction_type_id: transferData.transactionTypeId,
      category_id: null,
      related_transaction_id: insertedOutflowId,
    };

    const { data: inflowData, error: inflowError } = await this.supabase
      .from(this.TABLE_NAME)
      .insert([inflowPayload])
      .select('id')
      .single();

    if (inflowError) throw inflowError;
    const insertedInflowId = inflowData.id;

    // 3. Cruzar de regreso el ID de entrada en la transacción de salida
    const { error: updateError } = await this.supabase
      .from(this.TABLE_NAME)
      .update({ related_transaction_id: insertedInflowId })
      .eq('id', insertedOutflowId);

    if (updateError) throw updateError;
  }
}