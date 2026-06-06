import React from 'react';
import { Account } from "../types/finanzas";
import { excelExportService } from '../utils/excelExport';

interface AccountListProps {
  accounts: Account[];
  getAccountBalance: (accountId: string) => number;
  openAccountDetailModal: (accountId: string) => void;
}

const AccountList: React.FC<AccountListProps> = ({ accounts, getAccountBalance, openAccountDetailModal }) => {
  // Agrupar cuentas por categoría
  const groupedAccounts = accounts.reduce((acc, account) => {
    const category = account.categoria || 'Sin Categoría'; // Asignar una categoría por defecto si no existe
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(account);
    return acc;
  }, {} as Record<string, Account[]>);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900">Cuentas</h2>

        <button
          onClick={() => excelExportService.exportCuentas(accounts, getAccountBalance)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl flex items-center gap-2 transition-all shadow-sm hover:shadow active:scale-95 text-sm"
        >
          {/* Icono de descarga de documento Excel igual al de Transacciones */}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Exportar
        </button>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* El resto de tu layout para las categorías y las tarjetas de cuentas */}
        {Object.entries(groupedAccounts).map(([category, categoryAccounts]) => (
          <div key={category}>
            <h3 className="text-xs font-bold text-gray-400 tracking-wider mb-2">{category.toUpperCase()}</h3>
            <div className="flex flex-col gap-1.5">
              {categoryAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-2 rounded-lg border border-slate-200 text-sm transition-all cursor-pointer hover:bg-slate-50"
                  onClick={() => openAccountDetailModal(account.id)}
                >
                  <span className="font-medium text-slate-900">{account.nombre}</span>
                  <span className="font-semibold text-slate-700">
                    {account.moneda === "ARS" ? "$" : "US$"}{" "}
                    {getAccountBalance(account.id).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AccountList;
