"use client";

import { useState, useEffect } from "react";
import { useFinanzasStore } from "@/lib/store";

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddTransactionModal({ isOpen, onClose }: AddTransactionModalProps) {
  const { accounts, transactionTypes } = useFinanzasStore();

  const [selectedTransactionTypeId, setSelectedTransactionTypeId] = useState<string>('');
  const [selectedTransactionTypeCode, setSelectedTransactionTypeCode] = useState<string>('income');

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"ARS" | "USD">("ARS");
  
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [targetAccountId, setTargetAccountId] = useState("");
  const [sourceAccountText, setSourceAccountText] = useState("");
  const [targetAccountText, setTargetAccountText] = useState("");
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [errorMessage, setErrorMessage] = useState("");

  // Cortocircuito de seguridad: si no cargaron los tipos todavía, no ejecutamos lógica para evitar bucles
  useEffect(() => {
    if (transactionTypes && transactionTypes.length > 0 && !selectedTransactionTypeId) {
      const defaultIncomeType = transactionTypes.find(mt => mt.code === 'income');
      if (defaultIncomeType) {
        setSelectedTransactionTypeId(defaultIncomeType.id);
        setSelectedTransactionTypeCode('income');
      } else {
        setSelectedTransactionTypeId(transactionTypes[0].id);
        setSelectedTransactionTypeCode(transactionTypes[0].code || '');
      }
    }
  }, [transactionTypes]); 

  // Controladores visuales de los campos
  const isSelectOrigenDisabled = selectedTransactionTypeCode === 'income' || selectedTransactionTypeCode === 'adjustment';
  const isTextOrigenDisabled = selectedTransactionTypeCode === 'expense' || selectedTransactionTypeCode === 'transfer' || selectedTransactionTypeCode === 'adjustment';

  const isSelectDestinoDisabled = selectedTransactionTypeCode === 'expense' || selectedTransactionTypeCode === 'adjustment';
  const isTextDestinoDisabled = selectedTransactionTypeCode === 'income' || selectedTransactionTypeCode === 'transfer' || selectedTransactionTypeCode === 'adjustment';

  const handleSave = async (e: React.FormEvent) => {
    const addTransaction = useFinanzasStore.getState().addTransaction;

    e.preventDefault();
    setErrorMessage("");

    if (!selectedTransactionTypeId) {
      setErrorMessage("Por favor, seleccioná un tipo de movimiento válido.");
      return;
    }

    if (!description || !amount) {
      setErrorMessage("Por favor, completá la descripción y el monto.");
      return;
    }

    let finalSource: string | undefined = undefined;
    let finalTarget: string | undefined = undefined;
    let finalMovementAccountId: string = "";
    let finalCategory: string | null = null;
    let extraInfo = "";

    if (selectedTransactionTypeCode === 'income') {
      if (!targetAccountId) {
        setErrorMessage("Debés seleccionar una cuenta destino del sistema.");
        return;
      }
      finalSource = undefined; 
      finalTarget = targetAccountId;
      finalMovementAccountId = targetAccountId;
      if (sourceAccountText) extraInfo = ` (Origen Externo: ${sourceAccountText})`;

    } else if (selectedTransactionTypeCode === 'expense') {
      if (!sourceAccountId) {
        setErrorMessage("Debés seleccionar una cuenta origen del sistema.");
        return;
      }
      finalSource = sourceAccountId;
      finalTarget = undefined; 
      finalMovementAccountId = sourceAccountId;
      if (targetAccountText) extraInfo = ` (Destino Externo: ${targetAccountText})`;

    } else if (selectedTransactionTypeCode === 'transfer') {
      if (!sourceAccountId || !targetAccountId) {
        setErrorMessage("Para transferencias debés seleccionar origen y destino del sistema.");
        return;
      }
      if (sourceAccountId === targetAccountId) {
        setErrorMessage("La cuenta origen y destino no pueden ser iguales.");
        return;
      }
      finalSource = sourceAccountId;
      finalTarget = targetAccountId;
      finalMovementAccountId = sourceAccountId;

    } else if (selectedTransactionTypeCode === 'adjustment') {
      const referenceAccount = targetAccountId || sourceAccountId;
      if (!referenceAccount) {
        setErrorMessage("Seleccioná al menos una cuenta del sistema para aplicar el ajuste.");
        return;
      }
      finalSource = referenceAccount;
      finalTarget = referenceAccount;
      finalMovementAccountId = referenceAccount;
    }

    const systemAccount = accounts.find(acc => acc.id === finalMovementAccountId);
    if (systemAccount && systemAccount.moneda !== currency) {
      setErrorMessage(`La cuenta elegida opera en ${systemAccount.moneda}. No coincide con la moneda seleccionada.`);
      return;
    }

    if (systemAccount) {
      finalCategory = systemAccount.categoria;
    }

    // 2. Enviamos el objeto mapeado al nuevo esquema sin user_id y con las propiedades correctas
    await addTransaction({
      descripcion: description + extraInfo,
      monto: parseFloat(amount),
      moneda: currency,
      transaction_type_id: selectedTransactionTypeId,
      cuentaId: finalMovementAccountId,
      categoria: finalCategory,
      sourceAccountId: finalSource,
      targetAccountId: finalTarget,
      fecha: date,
    });

    // Reset de estados
    setDescription("");
    setAmount("");
    setCurrency("ARS");
    setSourceAccountId("");
    setTargetAccountId("");
    setSourceAccountText("");
    setTargetAccountText("");
    setDate(new Date().toISOString().split('T')[0]);
    onClose();
  };

  if (!isOpen) return null;
  // Freno de mano asincrónico por si el store sigue cargando los tipos desde Supabase
  if (!transactionTypes || transactionTypes.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900">Agregar Nueva entrada</h3>
          <p className="text-xs text-slate-500">Ingresá los datos reales del movimiento de caja</p>
        </div>
        
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Descripción</label>
            <input 
              type="text" 
              required
              placeholder="Ej. Pago Proveedor, Venta Servicio..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tipo</label>
              <select 
                value={selectedTransactionTypeId}
                onChange={(e) => {
                  const targetId = e.target.value;
                  const foundType = transactionTypes.find(mt => mt.id === targetId);
                  setSelectedTransactionTypeId(targetId);
                  setSelectedTransactionTypeCode(foundType ? (foundType.code || '') : '');
                  
                  setSourceAccountId("");
                  setTargetAccountId("");
                  setSourceAccountText("");
                  setTargetAccountText("");
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-slate-900 text-sm"
              >
                {transactionTypes.map((mt) => (
                  <option key={mt.id} value={mt.id}>{mt.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Monto</label>
              <input 
                type="number" 
                step="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Moneda</label>
              <select 
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value as "ARS" | "USD");
                  setSourceAccountId("");
                  setTargetAccountId("");
                  setSourceAccountText("");
                  setTargetAccountText("");
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-slate-900 text-sm"
              >
                <option value="ARS">ARS ($)</option>
                <option value="USD">USD (US$)</option>
              </select>
            </div>
          </div>

          {errorMessage && (
            <div className="bg-red-50 text-red-600 p-2.5 rounded-xl text-xs font-medium border border-red-100">{errorMessage}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cuenta Origen</label>
              <select
                value={sourceAccountId}
                onChange={(e) => setSourceAccountId(e.target.value)}
                disabled={isSelectOrigenDisabled}
                required={!isSelectOrigenDisabled}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-slate-900 text-sm mb-2 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">Seleccionar Cuenta...</option>
                {(accounts || []).filter(acc => acc.moneda === currency).map((account) => (
                  <option key={account.id} value={account.id}>{account.nombre}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="O escribir texto libre..."
                value={sourceAccountText}
                onChange={(e) => setSourceAccountText(e.target.value)}
                disabled={isTextOrigenDisabled}
                required={!isTextOrigenDisabled}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 text-sm disabled:bg-slate-100 disabled:placeholder-slate-300"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cuenta Destino</label>
              <select
                value={targetAccountId}
                onChange={(e) => setTargetAccountId(e.target.value)}
                disabled={isSelectDestinoDisabled}
                required={!isSelectDestinoDisabled}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-slate-900 text-sm mb-2 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">Seleccionar Cuenta...</option>
                {(accounts || []).filter(acc => acc.moneda === currency).map((account) => (
                  <option key={account.id} value={account.id}>{account.nombre}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="O escribir texto libre..."
                value={targetAccountText}
                onChange={(e) => setTargetAccountText(e.target.value)}
                disabled={isTextDestinoDisabled}
                required={!isTextDestinoDisabled}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 text-sm disabled:bg-slate-100 disabled:placeholder-slate-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 text-sm"
            />
          </div>

          <div className="pt-4 flex space-x-3 justify-end border-t border-slate-100">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-800 transition"
            >
              Guardar Registro
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}