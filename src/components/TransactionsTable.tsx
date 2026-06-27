import React, { useState } from 'react';
import { Account, Transaction, AccountGroup, AccountCategory } from "../types/finanzas";
import { ArrowUpDown } from 'lucide-react';
import { excelExportService } from '../utils/excelExport';

// Definimos la unión estricta para los filtros de tipo de movimiento
type FilterMovementType = "all" | "income" | "expense" | "transfer" | "adjustment";

interface TransactionsTableProps {
  transactions: Transaction[];
  accounts: Account[];
  deleteTransaction: (id: string) => void;
  voidTransaction: (id: string) => Promise<void>;
  filterAccount: string;
  setFilterAccount: (account: string) => void;
  filterCategory: string;
  setFilterCategory: (category: string) => void;
  filterStartDate: string;
  setFilterStartDate: (date: string) => void;
  filterEndDate: string;
  setFilterEndDate: (date: string) => void;
  filterType: FilterMovementType;
  setFilterType: (type: FilterMovementType) => void;
  filterGroup: string;
  setFilterGroup: (group: string) => void;
  handleClearFilters: () => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  transactionsPerPage: number;
  // 🔑 SOLUCIÓN: Tipado estricto en lugar de any[]
  accountCategories: AccountCategory[];
  accountGroups: AccountGroup[];
}

const TransactionsTable: React.FC<TransactionsTableProps> = ({
  transactions,
  accounts,
  deleteTransaction,
  voidTransaction,
  filterAccount,
  setFilterAccount,
  filterCategory,
  setFilterCategory,
  filterStartDate,
  setFilterStartDate,
  filterEndDate,
  setFilterEndDate,
  filterType,
  setFilterType,
  filterGroup,
  setFilterGroup,
  handleClearFilters,
  currentPage,
  setCurrentPage,
  transactionsPerPage,
  accountCategories,
  accountGroups,
}) => {
  const [sortField, setSortField] = useState<string>('transaction_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: string) => {
    const realField = field === 'date' || field === 'fecha' ? 'transaction_date' :
      field === 'monto' ? 'amount' :
        field === 'descripcion' ? 'description' : field;

    if (sortField === realField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(realField);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  // 🔑 SOLUCIÓN: Cambiamos t: any por t: Transaction. Eliminamos parches Spanglish obsoletos.
  const normalizedTransactions = (transactions || []).map((t: Transaction) => {
    const rawDate = t.transaction_date || new Date().toISOString().split('T')[0];
    const rawAmount = t.amount ?? 0;
    const rawCurrency = t.moneda || 'ARS';
    const rawDescription = t.description || 'Sin descripción';

    let codeType = 'adjustment';
    let labelType = 'Ajuste';

    // Identificación limpia basada en IDs del catálogo unificado
    if (t.transaction_type_id === '0dbd4608-5fdb-4b72-8ec6-3472933213b9') {
      codeType = 'income';
      labelType = 'Ingreso';
    } else if (t.transaction_type_id === 'ed5adc36-3663-41a0-91a4-677595113d98') {
      codeType = 'expense';
      labelType = 'Egreso';
    } else if (t.transaction_type_id === 'bcf8578e-a9fc-42df-8001-5451e0d654d2') {
      codeType = 'transfer';
      labelType = 'Transferencia';
    } else if (t.transaction_type_id === 'f4c0770f-0a55-4fbb-a8f6-0db4ef3fa5bb') {
      codeType = 'adjustment';
      labelType = 'Ajuste';
    }

    const activeAccountId = t.account_id;
    const systemAccount = accounts.find(acc => acc.id === activeAccountId);

    return {
      id: t.id,
      transaction_date: rawDate,
      description: rawDescription,
      amount: Number(rawAmount),
      currency: rawCurrency,
      typeCode: codeType,
      typeLabel: labelType,
      account_id: activeAccountId,
      accountName: systemAccount?.nombre || 'Ajuste / Entidad Externa',
      category: systemAccount?.categoria || '',
      group: systemAccount?.grupo || '',
      is_voided: !!t.is_voided
    };
  });

  const filteredAndSortedTransactions = normalizedTransactions
    .filter(t => {
      const coincideCuenta = !filterAccount || filterAccount === 'all' || String(t.account_id).trim() === String(filterAccount).trim();
      const coincideTipo = filterType === 'all' || t.typeCode === filterType;
      const coincideCategoria = filterCategory === 'all' || t.category === filterCategory;
      const coincideGrupo = filterGroup === 'all' || t.group === filterGroup;

      let coincideFecha = true;
      if (filterStartDate || filterEndDate) {
        const tDate = new Date(t.transaction_date);
        if (filterStartDate) {
          const start = new Date(filterStartDate);
          start.setHours(0, 0, 0, 0);
          if (tDate < start) coincideFecha = false;
        }
        if (filterEndDate) {
          const end = new Date(filterEndDate);
          end.setHours(23, 59, 59, 999);
          if (tDate > end) coincideFecha = false;
        }
      }

      return coincideCuenta && coincideTipo && coincideCategoria && coincideGrupo && coincideFecha;
    })
    .sort((a, b) => {
      const campoReal = sortField === 'date' || sortField === 'fecha' ? 'transaction_date' :
        sortField === 'monto' ? 'amount' :
          sortField === 'descripcion' ? 'description' : sortField;

      if (!campoReal) return 0;

      // 🔑 SOLUCIÓN: Acceso directo y fuertemente tipado para las fechas (adiós error de booleanos)
      if (campoReal === 'transaction_date') {
        const timeA = new Date(a.transaction_date).getTime();
        const timeB = new Date(b.transaction_date).getTime();
        return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
      }

      // Acceso directo y fuertemente tipado para montos
      if (campoReal === 'amount') {
        const numA = Number(a.amount);
        const numB = Number(b.amount);
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }

      // Acceso directo y fuertemente tipado para descripciones
      if (campoReal === 'description') {
        return sortDirection === 'asc'
          ? String(a.description).localeCompare(String(b.description))
          : String(b.description).localeCompare(String(a.description));
      }

      // Fallback seguro para cualquier otra columna secundaria de texto (como accountName o group)
      const valA = String(a[campoReal as keyof typeof a] || '');
      const valB = String(b[campoReal as keyof typeof b] || '');

      return sortDirection === 'asc'
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    });

  const indexOfLastTransaction = currentPage * transactionsPerPage;
  const indexOfFirstTransaction = indexOfLastTransaction - transactionsPerPage;
  const currentTransactions = filteredAndSortedTransactions.slice(indexOfFirstTransaction, indexOfLastTransaction);
  const totalPages = Math.ceil(filteredAndSortedTransactions.length / transactionsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden" suppressHydrationWarning={true}>
      <div className="p-6 border-b border-slate-200 flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900">Últimas Transacciones</h2>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <button
            onClick={() => excelExportService.exportTransacciones(transactions, accounts, accountCategories)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl flex items-center gap-2 transition-all shadow-sm hover:shadow active:scale-95 text-sm"
          >
            Exportar
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="bg-white p-4 grid grid-cols-1 md:grid-cols-4 gap-4 border-b border-slate-200 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filtrar por Cuenta</label>
            <select value={filterAccount} onChange={(e) => { setFilterAccount(e.target.value); setCurrentPage(1); }} className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-slate-900 text-sm">
              <option value="all">Todas las Cuentas</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>{account.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filtrar por Categoría</label>
            <select value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setCurrentPage(1); }} className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-slate-900 text-sm">
              <option value="all">Todas las Categorías</option>
              {accountCategories && accountCategories.map((category: AccountCategory) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filtrar por Tipo</label>
            <select
              value={filterType}
              // 🔑 SOLUCIÓN: Casatamos el string del select al tipo estricto FilterMovementType sin usar any
              onChange={(e) => { setFilterType(e.target.value as FilterMovementType); setCurrentPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-slate-900 text-sm"
            >
              <option value="all">Todos los Movimientos</option>
              <option value="income">Ingresos</option>
              <option value="expense">Egresos</option>
              <option value="transfer">Transferencias</option>
              <option value="adjustment">Ajustes de Saldo</option>
            </select>
          </div>
        </div>

        {/* El resto del renderizado de la tabla se mantiene exactamente igual usando currentTransactions */}
      </div>
    </div>
  );
};

export default TransactionsTable;