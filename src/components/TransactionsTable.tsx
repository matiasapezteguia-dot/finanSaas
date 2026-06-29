import React, { useState } from 'react';
import { Account, Transaction, AccountGroup, AccountCategory } from "../types/finanzas";
import { ArrowUpDown } from 'lucide-react';
import { excelExportService } from '../utils/excelExport';

// Unión estricta para los filtros de tipo de movimiento
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
  accountCategories: AccountCategory[]; // 🔑 Tipado estricto
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

  // Normalización limpia utilizando el tipado de Dominio 'Transaction'
  const normalizedTransactions = (transactions || []).map((t: Transaction) => {
    const rawDate = t.transaction_date || new Date().toISOString().split('T')[0];
    const rawAmount = t.amount ?? 0;
    const rawCurrency = t.moneda || 'ARS';
    const rawDescription = t.description || 'Sin descripción';

    let codeType = 'adjustment';
    let labelType = 'Ajuste';

    // Identificación basada en los IDs oficiales del catálogo
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

      // 🔑 Ordenamiento seguro e inmune a booleanos accidentales
      if (campoReal === 'transaction_date') {
        const timeA = new Date(a.transaction_date).getTime();
        const timeB = new Date(b.transaction_date).getTime();
        return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
      }

      if (campoReal === 'amount') {
        const numA = Number(a.amount);
        const numB = Number(b.amount);
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }

      if (campoReal === 'description') {
        return sortDirection === 'asc'
          ? String(a.description).localeCompare(String(b.description))
          : String(b.description).localeCompare(String(a.description));
      }

      const valA = String(a[campoReal as keyof typeof a] || '');
      const valB = String(b[campoReal as keyof typeof b] || '');

      return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
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
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        {/* Panel de Filtros */}
        <div className="bg-white p-4 grid grid-cols-1 md:grid-cols-4 gap-4 border-b border-slate-200 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filtrar por Cuenta</label>
            <select
              value={filterAccount}
              onChange={(e) => { setFilterAccount(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-slate-900 text-sm"
            >
              <option value="all">Todas las Cuentas</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>{account.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filtrar por Categoría</label>
            <select
              value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-slate-900 text-sm"
            >
              <option value="all">Todas las Categorías</option>
              {accountCategories && accountCategories.map((category: AccountCategory) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filtrar por Grupo</label>
            <select
              value={filterGroup}
              onChange={(e) => { setFilterGroup(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-slate-900 text-sm"
            >
              <option value="all">Todos los Grupos</option>
              {accountGroups.map(group => (
                <option key={group.id} value={group.name}>{group.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filtrar por Tipo</label>
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value as FilterMovementType); setCurrentPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-slate-900 text-sm"
            >
              <option value="all">Todos</option>
              <option value="income">Ingreso</option>
              <option value="expense">Egreso</option>
              <option value="transfer">Transferencia</option>
              <option value="adjustment">Ajuste</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Desde</label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => { setFilterStartDate(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hasta</label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => { setFilterEndDate(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 text-sm"
              />
            </div>
          </div>
          <div>
            <button
              onClick={handleClearFilters}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-300 transition"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>

        {/* 📋 TABLA DE RENDERIZADO COMPLETADA */}
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
              <th className="p-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('date')}>
                <div className="flex items-center justify-between">
                  Fecha <ArrowUpDown size={14} className="ml-1" />
                </div>
              </th>
              <th className="p-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('description')}>
                <div className="flex items-center justify-between">
                  Descripción <ArrowUpDown size={14} className="ml-1" />
                </div>
              </th>
              <th className="p-4">Cuenta Involucrada</th>
              <th className="p-4 text-center">Tipo</th>
              <th className="p-4 text-center">Moneda</th>
              <th className="p-4 text-right cursor-pointer hover:bg-slate-100" onClick={() => handleSort('amount')}>
                <div className="flex items-center justify-end">
                  Monto <ArrowUpDown size={14} className="ml-1" />
                </div>
              </th>
              <th className="p-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {currentTransactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">No hay transacciones registradas con los filtros actuales.</td>
              </tr>
            ) : (
              currentTransactions.map((t) => {
                const rowClasses = `hover:bg-slate-50 transition ${t.is_voided ? 'text-gray-400 line-through opacity-60' : ''}`;
                return (
                  <tr key={t.id} className={rowClasses}>
                    <td className="p-4">
                      {t.transaction_date ? new Date(t.transaction_date).toLocaleDateString('es-AR', { timeZone: 'UTC' }) : 'Sin Fecha'}
                    </td>
                    <td className="p-4 font-medium text-slate-900">{t.description}</td>
                    <td className="p-4 text-slate-600 font-medium">{t.accountName}</td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${t.typeCode === 'income' ? 'bg-green-100 text-green-700' :
                        t.typeCode === 'expense' ? 'bg-red-100 text-red-700' :
                          t.typeCode === 'transfer' ? 'bg-blue-100 text-blue-700' :
                            'bg-purple-100 text-purple-700'
                        }`}>
                        {t.typeLabel}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 rounded-md text-xs font-bold ${t.currency === 'ARS' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {t.currency}
                      </span>
                    </td>
                    <td className={`p-4 text-right font-bold ${t.typeCode === 'income' ? 'text-green-600' :
                      t.typeCode === 'expense' ? 'text-red-600' : 'text-blue-600'
                      }`}>                      
                      $ {Number(t.amount || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => {
                          const confirmar = window.confirm("⚠️ ¿Estás seguro de que deseas eliminar esta transacción?");
                          if (confirmar) deleteTransaction(t.id);
                        }}
                        className="text-red-600 hover:text-red-900 transition transform hover:scale-110"
                        title="Eliminar Transacción"
                      >
                        🗑️
                      </button>
                      <button
                        onClick={async () => {
                          const confirmar = window.confirm("⚠️ ¿Estás seguro de que deseas ANULAR esta transacción?");
                          if (confirmar) await voidTransaction(t.id);
                        }}
                        className="text-orange-600 hover:text-orange-900 transition transform hover:scale-110 ml-2"
                        title="Anular Transacción"
                        disabled={t.is_voided}
                      >
                        🚫
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {filteredAndSortedTransactions.length > transactionsPerPage && (
          <div className="p-4 flex justify-center items-center space-x-2 border-t border-slate-200">
            <button
              onClick={() => paginate(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="text-sm text-slate-700">Página {currentPage} de {totalPages}</span>
            <button
              onClick={() => paginate(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionsTable;