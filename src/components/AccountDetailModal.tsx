"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useFinanzasStore } from "@/lib/store";
import { Transaction, Account } from "../types/finanzas";

interface AccountDetailModalProps {
  accountId: string | null;
  onClose: () => void;
}

const AccountDetailModal: React.FC<AccountDetailModalProps> = ({ accountId, onClose }) => {
  // 💻 INYECTAMOS 'transactionTypes' para resolver el código relacional de los movimientos
  const { accounts, transactions, transactionTypes, getAccountBalance, getBalancesByGroup } = useFinanzasStore();
  const [account, setAccount] = useState<Account | undefined>(undefined);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<"all" | "income" | "expense" | "transfer">("all");
  const [filteredBalance, setFilteredBalance] = useState(0);

  useEffect(() => {
    if (accountId) {
      const selectedAccount = accounts.find((acc) => acc.id === accountId);
      setAccount(selectedAccount);
      applyFilters(selectedAccount, transactions, startDate, endDate, transactionTypeFilter);
    } else {
      setAccount(undefined);
      setFilteredTransactions([]);
      setFilteredBalance(0);
    }
  }, [accountId, accounts, transactions, startDate, endDate, transactionTypeFilter]);

  const applyFilters = (
    selectedAccount: Account | undefined,
    allTransactions: Transaction[],
    start: string,
    end: string,
    typeFilter: "all" | "income" | "expense" | "transfer"
  ) => {
    if (!selectedAccount) return;

    // 1. Filtramos transacciones vinculadas a la cuenta
    let tempTransactions = allTransactions.filter((t) =>
      t.cuentaId === selectedAccount.id || t.sourceAccountId === selectedAccount.id || t.targetAccountId === selectedAccount.id
    );

    // 2. Filtros de Fecha
    if (start) {
      tempTransactions = tempTransactions.filter((t) => t.fecha.split('T')[0] >= start);
    }
    if (end) {
      tempTransactions = tempTransactions.filter((t) => t.fecha.split('T')[0] <= end);
    }

    // 3. 🛡️ FILTRO DE TIPO CORREGIDO: Buscamos el código en el catálogo real del Store
    if (typeFilter !== "all") {
      tempTransactions = tempTransactions.filter((t) => {
        const tipoObj = transactionTypes.find(tt => tt.id === t.transaction_type_id || tt.id === (t as any).typeId);
        const codigoReal = tipoObj?.code?.toLowerCase().trim() || '';
        return codigoReal === typeFilter;
      });
    }

    setFilteredTransactions(tempTransactions);

    // 4. Calcular saldo acumulado del período filtrado
    let netBalance = 0;
    tempTransactions.forEach((t) => {
      // Si el movimiento opera sobre esta misma cuenta
      if (t.targetAccountId === selectedAccount.id && t.sourceAccountId === selectedAccount.id) {
        // Ajustes o cierres de cuenta que impactan sobre sí misma
        netBalance += t.monto;
      } else if (t.targetAccountId === selectedAccount.id) {
        netBalance += t.monto;
      } else if (t.sourceAccountId === selectedAccount.id) {
        netBalance -= t.monto;
      }
    });
    setFilteredBalance(netBalance);
  };

  const totalGroupBalance = useMemo(() => {
    if (!account) return { ARS: 0, USD: 0 };
    const balances = getBalancesByGroup(account.moneda);
    const groupBalance = account.grupo ? balances[account.grupo] || 0 : 0;
    return { [account.moneda]: groupBalance };
  }, [account, getBalancesByGroup]);

  if (!accountId || !account) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-900">Detalle de Cuenta: {account.nombre}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 font-bold text-lg">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Moneda</p>
              <p className="text-slate-900 font-medium">{account.moneda}</p>
            </div>
            
            {/* 🆕 SALDO INICIAL: Añadido exactamente en el espacio marcado de la imagen */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Saldo Inicial</p>
              <p className="text-slate-600 font-medium text-base">
                {account.moneda === "ARS" ? "$" : "US$"}{" "}
                {account.montoInicial.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Saldo Actual</p>
              <p className="text-slate-900 font-bold text-base">
                {account.moneda === "ARS" ? "$" : "US$"}{" "}
                {getAccountBalance(account.id).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <div className="col-span-1 sm:col-span-3 pt-2 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Grupo ({account.grupo})</p>
              <p className="text-slate-900 font-bold">
                {account.moneda === "ARS" ? "$" : "US$"}{" "}
                {totalGroupBalance[account.moneda]?.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-slate-50 p-4 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-4 border border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Desde</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Hasta</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Tipo de Movimiento</label>
              <select
                value={transactionTypeFilter}
                onChange={(e) => setTransactionTypeFilter(e.target.value as "all" | "income" | "expense" | "transfer")}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-slate-900 text-sm"
              >
                <option value="all">Todos</option>
                <option value="income">Ingreso</option>
                <option value="expense">Egreso</option>
                <option value="transfer">Transferencia</option>
              </select>
            </div>
          </div>

          {/* Saldo Neto del Filtro */}
          <div className="bg-blue-50 p-4 rounded-xl text-blue-800 font-bold text-center border border-blue-100 shadow-sm">
            Saldo Neto del Período: {account.moneda === "ARS" ? "$" : "US$"}{" "}
            {filteredBalance.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>

          {/* Historial de Transacciones */}
          <h4 className="text-md font-bold text-slate-900 mt-6 tracking-wide">Historial de Transacciones</h4>
          <div className="overflow-x-auto max-h-60 border border-slate-100 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10">
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Descripción</th>
                  <th className="p-3 text-center">Tipo</th>
                  <th className="p-3 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400 bg-white">
                      No hay transacciones registradas para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((t) => {
                    const isSource = t.sourceAccountId === account.id;
                    const displayAmount = isSource ? -t.monto : t.monto;
                    const amountClass = isSource ? "text-red-600" : "text-green-600";

                    // 🔄 RESOLUTOR EN CALIENTE: Obtenemos el tipo dinámicamente para las etiquetas de la lista
                    const tipoEncontrado = transactionTypes.find(tt => tt.id === t.transaction_type_id || tt.id === (t as any).typeId);
                    const codigoTipo = tipoEncontrado?.code?.toLowerCase().trim() || 'transfer';
                    const nombreTipo = tipoEncontrado?.name || 'Transferencia';

                    let badgeStyle = "bg-blue-100 text-blue-700";
                    if (codigoTipo === 'income' || codigoTipo === 'ingreso') badgeStyle = "bg-green-100 text-green-700";
                    if (codigoTipo === 'expense' || codigoTipo === 'egreso') badgeStyle = "bg-red-100 text-red-700";

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition bg-white">
                        <td className="p-3 whitespace-nowrap">{t.fecha}</td>
                        <td className="p-3">{t.descripcion}</td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${badgeStyle}`}>
                            {nombreTipo}
                          </span>
                        </td>
                        <td className={`p-3 text-right font-bold whitespace-nowrap ${amountClass}`}>
                          {displayAmount >= 0 ? '+ ' : '- '}{account.moneda === "ARS" ? "$" : "US$"}{" "}
                          {Math.abs(displayAmount).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountDetailModal;