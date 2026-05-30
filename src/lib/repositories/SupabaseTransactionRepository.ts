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
    transaction: Omit<Transaction, 'id' | 'created_at' | 'transaction_type_code'>,
    relatedTransactionId?: string
  ): Omit<SupabaseTransactionInsert, 'id' | 'created_at'> {
    return {
      account_id: transaction.cuentaId,
      transaction_type_id: transaction.transaction_type_id, // ¡UNIFICADO CON LA DB REAL!
      // BLINDAJE: Si no es un UUID válido (ej: texto libre como "asd"), se inserta null
      category_id: this.isUUID(transaction.categoria) ? transaction.categoria : null,
      amount: transaction.monto,
      description: transaction.descripcion,
      transaction_date: transaction.fecha,
      currency: transaction.moneda,
      related_transaction_id: relatedTransactionId,
    };
  }

  private fromSupabase(supabaseTransaction: SupabaseTransactionRow): Transaction {
    return {
      id: supabaseTransaction.id!,
      cuentaId: supabaseTransaction.account_id!,
      transaction_type_id: supabaseTransaction.transaction_type_id!, // ¡UNIFICADO CON LA DB REAL!
      categoria: supabaseTransaction.category_id, // Mapeado desde el campo real
      monto: supabaseTransaction.amount,
      descripcion: supabaseTransaction.description,
      fecha: supabaseTransaction.transaction_date,
      moneda: supabaseTransaction.currency as MonedaType,
      created_at: supabaseTransaction.created_at,
    };
  }

  async fetchAll(): Promise<Transaction[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.TABLE_NAME)
        .select('*');

      if (error) {
        // Captura y expone el objeto 'error' nativo de Supabase (PostgrestError)
        console.error('Error fetching transactions:', error);
        throw new Error(`Error fetching transactions: ${error.message}`);
      }

      // CORREGIDO: Se añade .bind(this) para que no falle el contexto en la iteración
      return (data as SupabaseTransactionRow[]).map(this.fromSupabase.bind(this));
    } catch (err) {
      // Asegura que cualquier error inesperado también sea loggeado
      console.error('Unhandled error in fetchAll transactions:', err);
      throw err;
    }
  }

  async save(transaction: Omit<Transaction, 'id' | 'created_at' | 'transaction_type_code'>): Promise<void> {
    const transactionTypeCode: MovementCodeType | undefined = (transaction as Transaction).transaction_type_code as MovementCodeType;

    if (transactionTypeCode === 'transfer' && transaction.sourceAccountId && transaction.targetAccountId) {
      const { cuentaId, monto, ...rest } = transaction;

      const sourceTransactionData = this.toSupabase({
        ...rest,
        cuentaId: transaction.sourceAccountId,
        monto: -Math.abs(monto),
      });

      const { data: sourceResult, error: sourceError } = await this.supabase
        .from(this.TABLE_NAME)
        .insert(sourceTransactionData as SupabaseTransactionInsert)
        .select('*');

      if (sourceError) {
        throw new Error(`Error saving source transfer transaction: ${sourceError.message}`);
      }

      const relatedTransactionId = (sourceResult as SupabaseTransactionRow[])?.[0]?.id;

      if (!relatedTransactionId) {
        throw new Error('Could not get ID for source transfer transaction.');
      }

      const targetTransactionData = this.toSupabase(
        {
          ...rest,
          cuentaId: transaction.targetAccountId,
          monto: Math.abs(monto),
        },
        relatedTransactionId
      );

      const { data: targetResult, error: targetError } = await this.supabase
        .from(this.TABLE_NAME)
        .insert(targetTransactionData as SupabaseTransactionInsert)
        .select('*');

      if (targetError) {
        throw new Error(`Error saving target transfer transaction: ${targetError.message}`);
      }

      const { error: updateSourceError } = await this.supabase
        .from(this.TABLE_NAME)
        .update({ related_transaction_id: (targetResult as SupabaseTransactionRow[])?.[0]?.id } as SupabaseTransactionUpdate)
        .eq('id', relatedTransactionId);

      if (updateSourceError) {
        console.error(`Error updating source transaction with related_transaction_id: ${updateSourceError.message}`);
      }

    } else {
      const supabaseData = this.toSupabase(transaction);
      const { error } = await this.supabase
        .from(this.TABLE_NAME)
        .insert(supabaseData as SupabaseTransactionInsert);

      if (error) {
        throw new Error(`Error saving transaction: ${error.message}`);
      }
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